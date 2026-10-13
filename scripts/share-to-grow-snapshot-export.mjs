import { Pool } from "pg";
import { postgresClientConfig } from "./postgres-connection.mjs";
import {
  buildSanitizedExportReport,
  SHARE_TO_GROW_NAMESPACE,
  validateExportObjectKey,
  validateRunId,
} from "./share-to-grow-snapshot-export-lib.mjs";
import { readPostgresShareToGrowSnapshot } from "./share-to-grow-postgres-snapshot-exporter.mjs";
import { readFilesystemShareToGrowSnapshot } from "./share-to-grow-efs-snapshot-exporter.mjs";
import { uploadSnapshotWithAwsCli } from "./share-to-grow-secure-s3-uploader.mjs";

function usage() {
  throw new Error(
    "Usage: node scripts/share-to-grow-snapshot-export.mjs --run-id <id> --bucket <name> --kms-key-arn <arn> --postgres-key <exports/<run-id>/postgres.snapshot.json> --filesystem-key <exports/<run-id>/filesystem.snapshot.json> [--efs-path /mnt/genesis-persistence/foundation/share-to-grow-repository.json] [--namespace share-to-grow-repository] [--expected-bucket-owner <account-id>]",
  );
}

function parseCli(argv) {
  const valueAfter = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const runId = valueAfter("--run-id");
  const bucket = valueAfter("--bucket");
  const kmsKeyArn = valueAfter("--kms-key-arn");
  const postgresKey = valueAfter("--postgres-key");
  const filesystemKey = valueAfter("--filesystem-key");
  const namespace = valueAfter("--namespace") ?? SHARE_TO_GROW_NAMESPACE;
  const efsPath = valueAfter("--efs-path") ?? "/mnt/genesis-persistence/foundation/share-to-grow-repository.json";
  const expectedBucketOwner = valueAfter("--expected-bucket-owner");

  if (!runId || !bucket || !kmsKeyArn || !postgresKey || !filesystemKey) usage();
  validateRunId(runId);
  validateExportObjectKey(postgresKey, runId);
  validateExportObjectKey(filesystemKey, runId);
  return {
    runId,
    bucket,
    kmsKeyArn,
    postgresKey,
    filesystemKey,
    namespace,
    efsPath,
    expectedBucketOwner,
  };
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const capturedAt = new Date().toISOString();
  const pool = new Pool({
    ...postgresClientConfig(),
    max: 1,
    application_name: "genesis-s2g-staging-snapshot-export",
  });
  try {
    const postgresSnapshot = await readPostgresShareToGrowSnapshot({
      pool,
      namespace: args.namespace,
      capturedAt,
    });
    const filesystemSnapshot = await readFilesystemShareToGrowSnapshot({
      sourcePath: args.efsPath,
      namespace: args.namespace,
      capturedAt,
    });

    const uploadedPostgres = await uploadSnapshotWithAwsCli({
      bucket: args.bucket,
      key: args.postgresKey,
      bodyText: postgresSnapshot.rawText,
      kmsKeyArn: args.kmsKeyArn,
      expectedBucketOwner: args.expectedBucketOwner,
      runId: args.runId,
    });
    const uploadedFilesystem = await uploadSnapshotWithAwsCli({
      bucket: args.bucket,
      key: args.filesystemKey,
      bodyText: filesystemSnapshot.rawText,
      kmsKeyArn: args.kmsKeyArn,
      expectedBucketOwner: args.expectedBucketOwner,
      runId: args.runId,
    });

    const report = buildSanitizedExportReport({
      runId: args.runId,
      namespace: args.namespace,
      bucket: args.bucket,
      kmsKeyArn: args.kmsKeyArn,
      snapshots: [
        {
          ...postgresSnapshot.metadata,
          objectKey: args.postgresKey,
          objectETag: uploadedPostgres.eTag,
          objectVersionId: uploadedPostgres.versionId,
        },
        {
          ...filesystemSnapshot.metadata,
          objectKey: args.filesystemKey,
          objectETag: uploadedFilesystem.eTag,
          objectVersionId: uploadedFilesystem.versionId,
        },
      ],
    });
    console.log(JSON.stringify(report));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((error) => {
    console.error(`S2G_SNAPSHOT_EXPORT=FAIL reason=${error.message}`);
    process.exitCode = 1;
  });
}

