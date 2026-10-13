import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REQUIRED_SSE = "aws:kms";

function validateBucketName(bucket) {
  if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("S3_BUCKET_INVALID");
  }
}

function validateKmsKeyArn(kmsKeyArn) {
  if (typeof kmsKeyArn !== "string" || !/^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]{36}$/i.test(kmsKeyArn)) {
    throw new Error("KMS_KEY_ARN_INVALID");
  }
}

export function buildPutObjectCommand({
  bucket,
  key,
  filePath,
  kmsKeyArn,
  expectedBucketOwner,
  runId,
}) {
  validateBucketName(bucket);
  validateKmsKeyArn(kmsKeyArn);
  if (typeof key !== "string" || key.length === 0) throw new Error("S3_OBJECT_KEY_INVALID");
  if (typeof filePath !== "string" || filePath.length === 0) throw new Error("S3_UPLOAD_FILE_PATH_INVALID");
  if (typeof runId !== "string" || runId.length === 0) throw new Error("S3_UPLOAD_RUN_ID_REQUIRED");

  const args = [
    "s3api",
    "put-object",
    "--bucket",
    bucket,
    "--key",
    key,
    "--body",
    filePath,
    "--server-side-encryption",
    REQUIRED_SSE,
    "--ssekms-key-id",
    kmsKeyArn,
    "--if-none-match",
    "*",
    "--content-type",
    "application/json",
    "--metadata",
    `run-id=${runId},namespace=share-to-grow-repository`,
    "--output",
    "json",
  ];
  if (expectedBucketOwner) {
    args.push("--expected-bucket-owner", expectedBucketOwner);
  }
  return args;
}

export async function uploadSnapshotWithAwsCli({
  bucket,
  key,
  bodyText,
  kmsKeyArn,
  expectedBucketOwner,
  runId,
  awsExecFileSync = execFileSync,
}) {
  const tempDir = await mkdtemp(join(tmpdir(), "s2g-snapshot-upload-"));
  const tempFile = join(tempDir, "snapshot.json");
  try {
    await writeFile(tempFile, bodyText, "utf8");
    const args = buildPutObjectCommand({
      bucket,
      key,
      filePath: tempFile,
      kmsKeyArn,
      expectedBucketOwner,
      runId,
    });
    const output = awsExecFileSync("aws", args, { encoding: "utf8" });
    const parsed = JSON.parse(output);
    return {
      eTag: parsed.ETag ?? null,
      versionId: parsed.VersionId ?? null,
      serverSideEncryption: parsed.ServerSideEncryption ?? null,
      sseKmsKeyId: parsed.SSEKMSKeyId ?? null,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

