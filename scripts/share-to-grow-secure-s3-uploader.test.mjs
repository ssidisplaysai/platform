import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPutObjectCommand,
  uploadSnapshotWithAwsCli,
} from "./share-to-grow-secure-s3-uploader.mjs";

test("builds put-object command with mandatory SSE-KMS and overwrite protection", () => {
  const args = buildPutObjectCommand({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/postgres.snapshot.json",
    filePath: "/tmp/snapshot.json",
    kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    expectedBucketOwner: "452630323448",
    runId: "s2g-run-001",
  });
  const joined = args.join(" ");
  assert.match(joined, /--server-side-encryption aws:kms/);
  assert.match(joined, /--ssekms-key-id arn:aws:kms:us-west-2:452630323448:key\/12345678-1234-1234-1234-1234567890ab/);
  assert.match(joined, /--if-none-match \*/);
  assert.match(joined, /--expected-bucket-owner 452630323448/);
});

test("rejects invalid KMS key ARN", () => {
  assert.throws(() => buildPutObjectCommand({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/postgres.snapshot.json",
    filePath: "/tmp/snapshot.json",
    kmsKeyArn: "alias/not-allowed",
    runId: "s2g-run-001",
  }), /KMS_KEY_ARN_INVALID/);
});

test("uploader returns only sanitized S3 put metadata", async () => {
  const calls = [];
  const result = await uploadSnapshotWithAwsCli({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/filesystem.snapshot.json",
    bodyText: "{\"schemaVersion\":1}",
    kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    runId: "s2g-run-001",
    awsExecFileSync(command, args) {
      calls.push({ command, args });
      return JSON.stringify({
        ETag: "\"abc\"",
        VersionId: "1",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      });
    },
  });
  assert.equal(calls[0].command, "aws");
  assert.equal(result.eTag, "\"abc\"");
  assert.equal(result.versionId, "1");
  assert.equal(result.serverSideEncryption, "aws:kms");
});

test("maps S3 and KMS access denied failures to fixed codes", async () => {
  await assert.rejects(
    uploadSnapshotWithAwsCli({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      awsExecFileSync() {
        const error = new Error("upload failed");
        error.stderr = "An error occurred (AccessDenied) when calling PutObject";
        throw error;
      },
    }),
    /S3_ACCESS_DENIED/,
  );

  await assert.rejects(
    uploadSnapshotWithAwsCli({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      awsExecFileSync() {
        const error = new Error("upload failed");
        error.stderr = "AccessDenied by KMS policy";
        throw error;
      },
    }),
    /KMS_ACCESS_DENIED/,
  );
});

test("maps precondition failures to overwrite collision code", async () => {
  await assert.rejects(
    uploadSnapshotWithAwsCli({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      awsExecFileSync() {
        const error = new Error("upload failed");
        error.stderr = "PreconditionFailed";
        throw error;
      },
    }),
    /S3_OBJECT_ALREADY_EXISTS/,
  );
});
