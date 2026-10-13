import assert from "node:assert/strict";
import test from "node:test";
import { mapErrorToFailureCode, runSnapshotExport } from "./share-to-grow-snapshot-export.mjs";

const baseEnvironment = {
  S2G_SNAPSHOT_EXPORT_BUCKET: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
  S2G_SNAPSHOT_EXPORT_KMS_KEY_ARN: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
  S2G_SNAPSHOT_EXPECTED_DB_USERNAME: "genesis_share_to_grow_snapshot_reader",
  DB_USERNAME: "genesis_share_to_grow_snapshot_reader",
  DB_PASSWORD: "x",
  DB_HOST: "db.internal",
  DB_PORT: "5432",
  DB_NAME: "genesis_staging",
  GENESIS_RDS_CA_CERT: "-----BEGIN CERTIFICATE-----\nA\n-----END CERTIFICATE-----\n",
};

function fakeSnapshot() {
  return {
    rawText: JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: "2026-10-13T00:00:00.000Z",
      data: {
        participants: [],
        trackingIdentities: [],
        ruleVersions: [],
        ledgerEntries: [],
        sourceEventReceipts: [],
        processedCommerceLines: [],
        payoutEntitlements: [],
        commerceAdjustments: [],
      },
    }),
    metadata: {
      backend: "postgres",
      namespace: "share-to-grow-repository",
      schemaVersion: 1,
      revision: 1,
      updatedAt: "2026-10-13T00:00:00.000Z",
      rawSha256: "a",
      canonicalSha256: "b",
      counts: { ledgerEntries: 0 },
    },
  };
}

test("refuses to run when DB username does not match dedicated snapshot reader", async () => {
  await assert.rejects(
    runSnapshotExport(["--run-id", "s2g-run-abc123"], {
      ...baseEnvironment,
      DB_USERNAME: "genesis_share_to_grow_app",
    }),
    /DB_CREDENTIAL_USERNAME_MISMATCH/,
  );
});

test("returns sanitized report using injected read-only dependencies", async () => {
  const snapshot = fakeSnapshot();
  const report = await runSnapshotExport(
    ["--run-id", "s2g-run-abc123"],
    baseEnvironment,
    {
      createPool() {
        return { end: async () => {} };
      },
      readPostgresShareToGrowSnapshot() {
        return Promise.resolve(snapshot);
      },
      readFilesystemShareToGrowSnapshot() {
        return Promise.resolve({
          ...snapshot,
          metadata: { ...snapshot.metadata, backend: "filesystem" },
        });
      },
      uploadSnapshotWithAwsCli() {
        return Promise.resolve({ eTag: "\"1\"", versionId: "v1" });
      },
    },
  );
  assert.equal(report.mode, "READ_ONLY_SNAPSHOT_EXPORT");
  assert.equal(report.snapshots.length, 2);
  assert.equal(report.snapshots[0].objectKey, "exports/s2g-run-abc123/postgres.snapshot.json");
});

for (const [message, code] of [
  ["POSTGRES_NAMESPACE_SNAPSHOT_NOT_FOUND", "EXPORT_NAMESPACE_NOT_FOUND"],
  ["SNAPSHOT_ENVELOPE_INVALID", "EXPORT_SNAPSHOT_INVALID"],
  ["ENOENT", "EXPORT_EFS_READ_FAILED"],
  ["S3_ACCESS_DENIED", "EXPORT_S3_ACCESS_DENIED"],
  ["KMS_ACCESS_DENIED", "EXPORT_KMS_ACCESS_DENIED"],
  ["S3_OBJECT_ALREADY_EXISTS", "EXPORT_S3_OVERWRITE_REJECTED"],
  ["password authentication failed", "EXPORT_DB_AUTH_FAILED"],
]) {
  test(`maps ${message} to sanitized failure code`, () => {
    assert.equal(mapErrorToFailureCode(new Error(message)), code);
  });
}

