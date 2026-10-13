import { Pool } from "pg";
import { postgresClientConfig } from "./postgres-connection.mjs";
import {
  buildSanitizedExportReport,
  SHARE_TO_GROW_NAMESPACE,
  validateRunId,
} from "./share-to-grow-snapshot-export-lib.mjs";
import { readPostgresShareToGrowSnapshot } from "./share-to-grow-postgres-snapshot-exporter.mjs";
import { readFilesystemShareToGrowSnapshot } from "./share-to-grow-efs-snapshot-exporter.mjs";
import { uploadSnapshotWithAwsCli } from "./share-to-grow-secure-s3-uploader.mjs";

function usage() {
  throw new Error(
    "Usage: node scripts/share-to-grow-snapshot-export.mjs --run-id <id> [--namespace share-to-grow-repository] [--efs-path /mnt/genesis-persistence/foundation/share-to-grow-repository.json]",
  );
}

export function parseCli(argv, environment = process.env) {
  const valueAfter = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const runId = valueAfter("--run-id");
  const namespace = valueAfter("--namespace") ?? SHARE_TO_GROW_NAMESPACE;
  const efsPath = valueAfter("--efs-path") ?? "/mnt/genesis-persistence/foundation/share-to-grow-repository.json";
  const bucket = environment.S2G_SNAPSHOT_EXPORT_BUCKET?.trim();
  const kmsKeyArn = environment.S2G_SNAPSHOT_EXPORT_KMS_KEY_ARN?.trim();
  const expectedBucketOwner = environment.S2G_SNAPSHOT_EXPECTED_BUCKET_OWNER?.trim();
  const expectedDbUsername = environment.S2G_SNAPSHOT_EXPECTED_DB_USERNAME?.trim();

  if (!runId) usage();
  validateRunId(runId);
  if (!bucket || !/^genesis-staging-s2g-snapshot-artifacts-\d{12}-[a-z0-9-]+$/.test(bucket)) {
    throw new Error("EXPORT_BUCKET_UNAPPROVED");
  }
  if (!kmsKeyArn || !/^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]{36}$/i.test(kmsKeyArn)) {
    throw new Error("EXPORT_KMS_KEY_UNAPPROVED");
  }
  if (!expectedDbUsername) {
    throw new Error("DB_EXPECTED_USERNAME_REQUIRED");
  }
  const postgresKey = `exports/${runId}/postgres.snapshot.json`;
  const filesystemKey = `exports/${runId}/filesystem.snapshot.json`;
  return {
    runId,
    bucket,
    kmsKeyArn,
    postgresKey,
    filesystemKey,
    namespace,
    efsPath,
    expectedBucketOwner,
    expectedDbUsername,
  };
}

export function mapErrorToFailureCode(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  if (message.includes("28000") || message.includes("authentication")) return "EXPORT_DB_AUTH_FAILED";
  if (message.includes("POSTGRES_NAMESPACE_SNAPSHOT_NOT_FOUND")) return "EXPORT_NAMESPACE_NOT_FOUND";
  if (message.includes("SNAPSHOT_ENVELOPE_INVALID") || message.includes("SNAPSHOT_COLLECTION_INVALID")) {
    return "EXPORT_SNAPSHOT_INVALID";
  }
  if (message.includes("ENOENT")) return "EXPORT_EFS_READ_FAILED";
  if (message.includes("S3_ACCESS_DENIED")) return "EXPORT_S3_ACCESS_DENIED";
  if (message.includes("KMS_ACCESS_DENIED")) return "EXPORT_KMS_ACCESS_DENIED";
  if (message.includes("S3_OBJECT_ALREADY_EXISTS")) return "EXPORT_S3_OVERWRITE_REJECTED";
  if (message.includes("EXPORT_BUCKET_UNAPPROVED")) return "EXPORT_BUCKET_UNAPPROVED";
  if (message.includes("EXPORT_KMS_KEY_UNAPPROVED")) return "EXPORT_KMS_KEY_UNAPPROVED";
  if (message.includes("DB_EXPECTED_USERNAME_REQUIRED")) return "EXPORT_DB_USERNAME_EXPECTATION_MISSING";
  if (message.includes("DB_CREDENTIAL_USERNAME_MISMATCH")) return "EXPORT_DB_USERNAME_MISMATCH";
  if (message.includes("POSTGRES_READ_ONLY_TRANSACTION_REQUIRED")) return "EXPORT_POSTGRES_READ_ONLY_REQUIRED";
  return "EXPORT_FAILED";
}

export async function runSnapshotExport(argv, environment = process.env, dependencies = {}) {
  const args = parseCli(argv, environment);
  const configuredDbUsername = environment.DB_USERNAME?.trim();
  if (configuredDbUsername !== args.expectedDbUsername) {
    throw new Error("DB_CREDENTIAL_USERNAME_MISMATCH");
  }
  const capturedAt = new Date().toISOString();
  const createPool = dependencies.createPool ?? ((config) => new Pool(config));
  const readPostgres = dependencies.readPostgresShareToGrowSnapshot ?? readPostgresShareToGrowSnapshot;
  const readFilesystem = dependencies.readFilesystemShareToGrowSnapshot ?? readFilesystemShareToGrowSnapshot;
  const uploadSnapshot = dependencies.uploadSnapshotWithAwsCli ?? uploadSnapshotWithAwsCli;
  const pool = createPool({
    ...postgresClientConfig(environment),
    max: 1,
    application_name: "genesis-s2g-staging-snapshot-export",
  });
  try {
    const postgresSnapshot = await readPostgres({
      pool,
      namespace: args.namespace,
      capturedAt,
    });
    const filesystemSnapshot = await readFilesystem({
      sourcePath: args.efsPath,
      namespace: args.namespace,
      capturedAt,
    });

    const uploadedPostgres = await uploadSnapshot({
      bucket: args.bucket,
      key: args.postgresKey,
      bodyText: postgresSnapshot.rawText,
      kmsKeyArn: args.kmsKeyArn,
      expectedBucketOwner: args.expectedBucketOwner,
      runId: args.runId,
    });
    const uploadedFilesystem = await uploadSnapshot({
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
    return report;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runSnapshotExport(process.argv.slice(2)).then((report) => {
    console.log(JSON.stringify(report));
  }).catch((error) => {
    console.error(`S2G_SNAPSHOT_EXPORT=FAIL code=${mapErrorToFailureCode(error)}`);
    process.exitCode = 1;
  });
}
