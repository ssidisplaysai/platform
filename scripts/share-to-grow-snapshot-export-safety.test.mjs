import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { mapErrorToFailureCode, parseCli } from "./share-to-grow-snapshot-export.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

test("snapshot export path includes no database mutation SQL", async () => {
  const source = await read("scripts/share-to-grow-postgres-snapshot-exporter.mjs");
  assert.doesNotMatch(source, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i);
  assert.match(source, /BEGIN READ ONLY/);
  assert.match(source, /ROLLBACK/);
});

test("snapshot export path includes no EFS mutation operations", async () => {
  const source = await read("scripts/share-to-grow-efs-snapshot-exporter.mjs");
  assert.match(source, /readFile/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|rm|unlink|rename)\b/);
});

test("snapshot export CLI logs only sanitized metadata", async () => {
  const source = await read("scripts/share-to-grow-snapshot-export.mjs");
  assert.match(source, /buildSanitizedExportReport/);
  assert.doesNotMatch(source, /console\.log\(([^)]*rawText|[^)]*envelope\.data)/);
  assert.doesNotMatch(source, /console\.error\([^)]*error\.message/);
});

test("snapshot export CLI requires approved bucket, key, and dedicated db reader username", () => {
  assert.throws(() => parseCli(["--run-id", "s2g-run-01"], {
    S2G_SNAPSHOT_EXPORT_BUCKET: "random-bucket",
    S2G_SNAPSHOT_EXPORT_KMS_KEY_ARN: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    S2G_SNAPSHOT_EXPECTED_DB_USERNAME: "genesis_share_to_grow_snapshot_reader",
  }), /EXPORT_BUCKET_UNAPPROVED/);

  assert.throws(() => parseCli(["--run-id", "s2g-run-01"], {
    S2G_SNAPSHOT_EXPORT_BUCKET: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    S2G_SNAPSHOT_EXPORT_KMS_KEY_ARN: "invalid-kms",
    S2G_SNAPSHOT_EXPECTED_DB_USERNAME: "genesis_share_to_grow_snapshot_reader",
  }), /EXPORT_KMS_KEY_UNAPPROVED/);

  assert.throws(() => parseCli(["--run-id", "s2g-run-01"], {
    S2G_SNAPSHOT_EXPORT_BUCKET: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    S2G_SNAPSHOT_EXPORT_KMS_KEY_ARN: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
  }), /DB_EXPECTED_USERNAME_REQUIRED/);
});

test("maps sensitive runtime failures to fixed sanitized failure codes", () => {
  assert.equal(mapErrorToFailureCode(new Error("password authentication failed for user")), "EXPORT_DB_AUTH_FAILED");
  assert.equal(mapErrorToFailureCode(new Error("POSTGRES_NAMESPACE_SNAPSHOT_NOT_FOUND")), "EXPORT_NAMESPACE_NOT_FOUND");
  assert.equal(mapErrorToFailureCode(new Error("SNAPSHOT_ENVELOPE_INVALID")), "EXPORT_SNAPSHOT_INVALID");
  assert.equal(mapErrorToFailureCode(new Error("ENOENT: no such file or directory")), "EXPORT_EFS_READ_FAILED");
  assert.equal(mapErrorToFailureCode(new Error("S3_ACCESS_DENIED")), "EXPORT_S3_ACCESS_DENIED");
  assert.equal(mapErrorToFailureCode(new Error("KMS_ACCESS_DENIED")), "EXPORT_KMS_ACCESS_DENIED");
  assert.equal(mapErrorToFailureCode(new Error("S3_OBJECT_ALREADY_EXISTS")), "EXPORT_S3_OVERWRITE_REJECTED");
});
