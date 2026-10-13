import assert from "node:assert/strict";
import test from "node:test";
import { buildDryRunReconciliationManifest } from "./share-to-grow-reconciliation-dry-run.mjs";

function envelope(data, revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: "2026-10-13T00:00:00.000Z",
    data,
  };
}

function baseState() {
  return {
    participants: [],
    trackingIdentities: [],
    ruleVersions: [],
    sourceEventReceipts: [],
    processedCommerceLines: [],
    ledgerEntries: [],
    payoutEntitlements: [],
    commerceAdjustments: [],
  };
}

function withOrder665Organic(state) {
  const next = structuredClone(state);
  next.sourceEventReceipts.push({
    sourceEventId: "receipt-665",
    source: "woocommerce",
    eventType: "order.updated",
    payloadHash: "hash-665",
    receivedAt: "2026-10-13T07:46:02.161Z",
  });
  next.processedCommerceLines.push({
    lineKey: "woocommerce:665:11",
    sourceEventId: "receipt-665",
    organizationId: "stoner",
    attribution: { selectedPartnerId: null, selectedTrackingIdentityId: null },
    ruleVersionId: "stoner-gym-organic-v1",
    ledgerEntryIds: ["earning:woocommerce:665:11:stoner-gym-organic-v1:stoner"],
    processedAt: "2026-10-13T07:46:02.300Z",
  });
  next.ledgerEntries.push({
    id: "earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
    idempotencyKey: "earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
    beneficiaryId: "stoner",
    entryType: "earning",
    amountMinor: "9700",
    currency: "USD",
    postedAt: "2026-10-13T07:46:02.300Z",
  });
  next.payoutEntitlements.push({
    entitlementId: "entitlement:earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
    beneficiaryId: "stoner",
    currency: "USD",
    ledgerEntryId: "earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
    amountMinor: "9700",
    state: "pending",
    earnedAt: "2026-10-13T07:46:02.300Z",
    clearsAt: "2026-10-27T07:46:02.300Z",
  });
  return next;
}

function withOrder666DanielDirect(state) {
  const next = structuredClone(state);
  next.sourceEventReceipts.push({
    sourceEventId: "s2g-stg-order-666-d1",
    source: "woocommerce",
    eventType: "order.updated",
    payloadHash: "hash-666",
    receivedAt: "2026-10-13T16:20:02.161Z",
  });
  next.processedCommerceLines.push({
    lineKey: "woocommerce:666:12",
    sourceEventId: "s2g-stg-order-666-d1",
    organizationId: "stoner",
    attribution: {
      selectedPartnerId: "daniel-coffeen",
      selectedTrackingIdentityId: "tracking-stoner-gym-daniel-coffeen-v1",
    },
    ruleVersionId: "stoner-gym-daniel-direct-v1",
    ledgerEntryIds: [
      "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:stoner",
      "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:daniel-coffeen",
    ],
    processedAt: "2026-10-13T16:20:02.300Z",
  });
  next.ledgerEntries.push({
    id: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:stoner",
    idempotencyKey: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:stoner",
    beneficiaryId: "stoner",
    entryType: "earning",
    amountMinor: "3700",
    currency: "USD",
    postedAt: "2026-10-13T16:20:02.300Z",
  });
  next.ledgerEntries.push({
    id: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:daniel-coffeen",
    idempotencyKey: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:daniel-coffeen",
    beneficiaryId: "daniel-coffeen",
    entryType: "earning",
    amountMinor: "3700",
    currency: "USD",
    postedAt: "2026-10-13T16:20:02.300Z",
  });
  next.payoutEntitlements.push({
    entitlementId: "entitlement:earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:stoner",
    beneficiaryId: "stoner",
    currency: "USD",
    ledgerEntryId: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:stoner",
    amountMinor: "3700",
    state: "pending",
    earnedAt: "2026-10-13T16:20:02.300Z",
    clearsAt: "2026-10-27T16:20:02.300Z",
  });
  next.payoutEntitlements.push({
    entitlementId: "entitlement:earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:daniel-coffeen",
    beneficiaryId: "daniel-coffeen",
    currency: "USD",
    ledgerEntryId: "earning:woocommerce:666:12:stoner-gym-daniel-direct-v1:daniel-coffeen",
    amountMinor: "3700",
    state: "pending",
    earnedAt: "2026-10-13T16:20:02.300Z",
    clearsAt: "2026-10-27T16:20:02.300Z",
  });
  return next;
}

function runDryRun(postgresState, filesystemState) {
  return buildDryRunReconciliationManifest({
    generatedAt: "2026-10-13T20:00:00.000Z",
    postgresSnapshot: envelope(postgresState, 38),
    filesystemSnapshot: envelope(filesystemState, 26),
    postgresRawSnapshotText: JSON.stringify(envelope(postgresState, 38)),
    filesystemRawSnapshotText: JSON.stringify(envelope(filesystemState, 26)),
  });
}

test("classifies exact duplicates and unique records for #665 and #666 fixtures", () => {
  const shared = baseState();
  const postgres = withOrder665Organic(shared);
  const filesystem = withOrder666DanielDirect(shared);
  const manifest = runDryRun(postgres, filesystem);

  assert.equal(manifest.collisionCounts.processedCommerceLines.uniqueToPostgres, 1);
  assert.equal(manifest.collisionCounts.processedCommerceLines.uniqueToFilesystem, 1);
  assert.deepEqual(manifest.collision.processedCommerceLines.uniqueToPostgres, ["woocommerce:665:11"]);
  assert.deepEqual(manifest.collision.processedCommerceLines.uniqueToFilesystem, ["woocommerce:666:12"]);
  assert.equal(manifest.sourceSnapshots.postgres.financialTotals.earningMinor, "9700");
  assert.equal(manifest.sourceSnapshots.filesystem.financialTotals.earningMinor, "7400");
});

test("detects same identity conflicting content", () => {
  const postgres = withOrder665Organic(baseState());
  const filesystem = withOrder665Organic(baseState());
  filesystem.sourceEventReceipts[0].payloadHash = "different-hash";
  const manifest = runDryRun(postgres, filesystem);
  assert.deepEqual(manifest.collision.sourceEventReceipts.conflictingSameIdentity, ["receipt-665"]);
  assert.equal(manifest.readyToApply, false);
});

test("detects ledger idempotency collisions with different content", () => {
  const postgres = withOrder665Organic(baseState());
  const filesystem = withOrder666DanielDirect(baseState());
  filesystem.ledgerEntries.push({
    id: "other-ledger-id",
    idempotencyKey: "earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
    beneficiaryId: "stoner",
    entryType: "earning",
    amountMinor: "111",
    currency: "USD",
    postedAt: "2026-10-13T00:00:00.000Z",
  });
  const manifest = runDryRun(postgres, filesystem);
  assert.equal(manifest.collisionCounts.ledgerByIdempotencyKey.conflictingSameIdentity, 1);
  assert.equal(
    manifest.collision.ledgerByIdempotencyKey.conflictingSameIdentity[0],
    "earning:woocommerce:665:11:stoner-gym-organic-v1:stoner",
  );
});

test("flags missing receipt references", () => {
  const postgres = withOrder665Organic(baseState());
  postgres.processedCommerceLines[0].sourceEventId = "missing-receipt";
  const manifest = runDryRun(postgres, baseState());
  assert.deepEqual(manifest.sourceSnapshots.postgres.referentialIntegrity.processedMissingReceipt, ["woocommerce:665:11"]);
  assert.equal(manifest.readyToApply, false);
});

test("flags missing ledger references for processed lines and entitlements", () => {
  const postgres = withOrder665Organic(baseState());
  postgres.processedCommerceLines[0].ledgerEntryIds = ["missing-ledger-id"];
  postgres.payoutEntitlements[0].ledgerEntryId = "missing-ledger-id";
  const manifest = runDryRun(postgres, baseState());
  assert.deepEqual(manifest.sourceSnapshots.postgres.referentialIntegrity.processedMissingLedger, ["woocommerce:665:11"]);
  assert.deepEqual(
    manifest.sourceSnapshots.postgres.referentialIntegrity.entitlementLedgerMissing,
    ["entitlement:earning:woocommerce:665:11:stoner-gym-organic-v1:stoner"],
  );
});

test("flags orphaned adjustments and reversal dependencies", () => {
  const postgres = withOrder665Organic(baseState());
  postgres.commerceAdjustments.push({
    adjustmentId: "refund:665:1",
    kind: "refund",
    orderId: "665",
    sourceEventId: "receipt-665-r1",
    refundId: "1",
    lineRefunds: [{ lineKey: "woocommerce:665:missing-line", refundMinor: "100" }],
    disposition: "reversed",
    reversalLedgerEntryIds: ["reversal:missing"],
    recordedAt: "2026-10-13T00:00:00.000Z",
  });
  postgres.ledgerEntries.push({
    id: "reversal:missing",
    idempotencyKey: "reversal:missing",
    beneficiaryId: "stoner",
    entryType: "reversal",
    amountMinor: "-100",
    currency: "USD",
    sourceEntryId: "earning:missing",
    postedAt: "2026-10-13T00:00:00.000Z",
  });
  const manifest = runDryRun(postgres, baseState());
  assert.deepEqual(
    manifest.sourceSnapshots.postgres.referentialIntegrity.adjustmentMissingLine,
    ["refund:665:1"],
  );
  assert.deepEqual(
    manifest.sourceSnapshots.postgres.referentialIntegrity.reversalMissingSource,
    ["reversal:missing"],
  );
});

test("flags incompatible entitlement lifecycle states", () => {
  const postgres = withOrder665Organic(baseState());
  postgres.payoutEntitlements[0].state = "processing";
  const manifest = runDryRun(postgres, baseState());
  assert.deepEqual(
    manifest.sourceSnapshots.postgres.referentialIntegrity.entitlementLifecycleInvalid,
    ["entitlement:earning:woocommerce:665:11:stoner-gym-organic-v1:stoner"],
  );
});

test("is deterministic for repeated runs with identical inputs", () => {
  const postgres = withOrder665Organic(baseState());
  const filesystem = withOrder666DanielDirect(baseState());
  const first = runDryRun(postgres, filesystem);
  const second = runDryRun(postgres, filesystem);
  assert.equal(first.canonicalManifestSha256, second.canonicalManifestSha256);
  assert.equal(first.canonicalManifest, second.canonicalManifest);
});

test("proposed insert order remains fixed and deterministic", () => {
  const manifest = runDryRun(withOrder665Organic(baseState()), withOrder666DanielDirect(baseState()));
  assert.deepEqual(manifest.proposedInsertOrder, [
    "participants",
    "trackingIdentities",
    "ruleVersions",
    "sourceEventReceipts",
    "ledgerEntries",
    "processedCommerceLines",
    "payoutEntitlements",
    "commerceAdjustments",
  ]);
});

test("idempotent candidate reconciliation yields stable merged counts", () => {
  const postgres = withOrder665Organic(baseState());
  const filesystem = withOrder666DanielDirect(baseState());
  const manifest = runDryRun(postgres, filesystem);
  assert.equal(manifest.expectedMergedCounts.processedCommerceLines, 2);
  assert.equal(manifest.expectedMergedCounts.ledgerEntries, 3);
  assert.equal(manifest.expectedMergedCounts.payoutEntitlements, 3);
  assert.equal(manifest.expectedMergedFinancialTotals.earningMinor, "17100");
});
