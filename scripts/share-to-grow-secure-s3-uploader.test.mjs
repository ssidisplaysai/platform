import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPutObjectCommand,
  uploadSnapshotToS3,
} from "./share-to-grow-secure-s3-uploader.mjs";

test("builds put-object request with mandatory SSE-KMS and overwrite protection", () => {
  const input = buildPutObjectCommand({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/postgres.snapshot.json",
    bodyText: "{\"schemaVersion\":1}",
    kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    expectedBucketOwner: "452630323448",
    runId: "s2g-run-001",
  });
  assert.equal(input.ServerSideEncryption, "aws:kms");
  assert.equal(input.SSEKMSKeyId, "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab");
  assert.equal(input.IfNoneMatch, "*");
  assert.equal(input.ExpectedBucketOwner, "452630323448");
  assert.equal(input.Metadata["run-id"], "s2g-run-001");
});

test("rejects invalid KMS key ARN", () => {
  assert.throws(() => buildPutObjectCommand({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/postgres.snapshot.json",
    bodyText: "{\"schemaVersion\":1}",
    kmsKeyArn: "alias/not-allowed",
    runId: "s2g-run-001",
  }), /KMS_KEY_ARN_INVALID/);
});

test("uploader returns only sanitized S3 put metadata", async () => {
  const calls = [];
  const result = await uploadSnapshotToS3({
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    key: "exports/s2g-run-001/filesystem.snapshot.json",
    bodyText: "{\"schemaVersion\":1}",
    kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    runId: "s2g-run-001",
    s3Client: {
      async send(command) {
        calls.push(command.input);
        return {
        ETag: "\"abc\"",
        VersionId: "1",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
        };
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].Bucket, "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2");
  assert.equal(result.eTag, "\"abc\"");
  assert.equal(result.versionId, "1");
  assert.equal(result.serverSideEncryption, "aws:kms");
});

test("maps S3 and KMS access denied failures to fixed codes", async () => {
  await assert.rejects(
    uploadSnapshotToS3({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      s3Client: {
        async send() {
          const error = new Error("AccessDenied");
          error.name = "AccessDenied";
          error.$metadata = { httpStatusCode: 403 };
          throw error;
        },
      },
    }),
    /S3_ACCESS_DENIED/,
  );

  await assert.rejects(
    uploadSnapshotToS3({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      s3Client: {
        async send() {
          const error = new Error("AccessDenied by KMS policy");
          error.name = "KMSAccessDeniedException";
          error.$metadata = { httpStatusCode: 403 };
          throw error;
        },
      },
    }),
    /KMS_ACCESS_DENIED/,
  );
});

test("maps precondition failures to overwrite collision code", async () => {
  await assert.rejects(
    uploadSnapshotToS3({
      bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
      key: "exports/s2g-run-001/filesystem.snapshot.json",
      bodyText: "{\"schemaVersion\":1}",
      kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
      runId: "s2g-run-001",
      s3Client: {
        async send() {
          const error = new Error("PreconditionFailed");
          error.name = "PreconditionFailed";
          error.$metadata = { httpStatusCode: 412 };
          throw error;
        },
      },
    }),
    /S3_OBJECT_ALREADY_EXISTS/,
  );
});
