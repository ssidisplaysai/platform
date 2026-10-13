import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSanitizedExportReport,
  buildSnapshotMetadata,
  normalizeEnvelope,
  validateExportObjectKey,
  validateRunId,
} from "./share-to-grow-snapshot-export-lib.mjs";

function envelope() {
  return {
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
  };
}

test("accepts run IDs and run-scoped object keys", () => {
  validateRunId("s2g-run-20261013");
  validateExportObjectKey("exports/s2g-run-20261013/postgres.snapshot.json", "s2g-run-20261013");
  validateExportObjectKey("exports/s2g-run-20261013/filesystem.snapshot.json", "s2g-run-20261013");
});

test("rejects malformed run IDs and mismatched object scope", () => {
  assert.throws(() => validateRunId("BAD"), /RUN_ID_INVALID/);
  assert.throws(
    () => validateExportObjectKey("exports/other-run/postgres.snapshot.json", "s2g-run-20261013"),
    /EXPORT_OBJECT_KEY_RUN_SCOPE_INVALID/,
  );
});

test("normalizes snake-case envelope and produces deterministic metadata", () => {
  const normalized = normalizeEnvelope({
    schema_version: 1,
    revision: "26",
    updated_at: "2026-10-13T00:00:00.000Z",
    data: envelope().data,
  });
  const metadata = buildSnapshotMetadata({
    backend: "filesystem",
    namespace: "share-to-grow-repository",
    envelope: normalized,
    rawText: JSON.stringify(normalized),
    capturedAt: "2026-10-13T20:00:00.000Z",
  });
  const metadataAgain = buildSnapshotMetadata({
    backend: "filesystem",
    namespace: "share-to-grow-repository",
    envelope: normalized,
    rawText: JSON.stringify(normalized),
    capturedAt: "2026-10-13T20:00:00.000Z",
  });
  assert.equal(metadata.rawSha256, metadataAgain.rawSha256);
  assert.equal(metadata.canonicalSha256, metadataAgain.canonicalSha256);
});

test("sanitized report excludes raw financial record payloads", () => {
  const report = buildSanitizedExportReport({
    runId: "s2g-run-1",
    namespace: "share-to-grow-repository",
    bucket: "genesis-staging-s2g-snapshot-artifacts-452630323448-us-west-2",
    kmsKeyArn: "arn:aws:kms:us-west-2:452630323448:key/12345678-1234-1234-1234-1234567890ab",
    snapshots: [{
      backend: "postgres",
      schemaVersion: 1,
      revision: 1,
      updatedAt: "2026-10-13T00:00:00.000Z",
      rawSha256: "a",
      canonicalSha256: "b",
      counts: { ledgerEntries: 0 },
      objectKey: "exports/s2g-run-1/postgres.snapshot.json",
    }],
  });
  assert.equal(report.snapshots[0].counts.ledgerEntries, 0);
  assert.equal(report.snapshots[0].backend, "postgres");
  assert.equal(report.snapshots[0].rawText, undefined);
  assert.equal(report.snapshots[0].data, undefined);
});

