import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const COLLECTIONS = Object.freeze([
  "participants",
  "trackingIdentities",
  "ruleVersions",
  "sourceEventReceipts",
  "processedCommerceLines",
  "ledgerEntries",
  "payoutEntitlements",
  "commerceAdjustments",
]);

const ID_FIELDS = Object.freeze({
  participants: "participantId",
  trackingIdentities: "trackingIdentityId",
  ruleVersions: "id",
  sourceEventReceipts: "sourceEventId",
  processedCommerceLines: "lineKey",
  ledgerEntries: "id",
  payoutEntitlements: "entitlementId",
  commerceAdjustments: "adjustmentId",
});

const ENTITLEMENT_STATES = new Set(["pending", "cleared", "payable", "paid", "reversed"]);
const PROPOSED_INSERT_ORDER = Object.freeze([
  "participants",
  "trackingIdentities",
  "ruleVersions",
  "sourceEventReceipts",
  "ledgerEntries",
  "processedCommerceLines",
  "payoutEntitlements",
  "commerceAdjustments",
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Utf8(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function toEnvelope(snapshot) {
  if (snapshot && typeof snapshot === "object" && snapshot.envelope && typeof snapshot.envelope === "object") {
    return toEnvelope(snapshot.envelope);
  }
  if (
    snapshot
    && typeof snapshot === "object"
    && Number.isSafeInteger(snapshot.schemaVersion)
    && Number.isSafeInteger(snapshot.revision)
    && typeof snapshot.updatedAt === "string"
    && snapshot.data
    && typeof snapshot.data === "object"
    && !Array.isArray(snapshot.data)
  ) {
    return snapshot;
  }
  if (
    snapshot
    && typeof snapshot === "object"
    && Number.isSafeInteger(snapshot.schema_version)
    && typeof snapshot.revision !== "undefined"
    && typeof snapshot.updated_at === "string"
    && snapshot.data
    && typeof snapshot.data === "object"
    && !Array.isArray(snapshot.data)
  ) {
    const revision = Number(snapshot.revision);
    if (!Number.isSafeInteger(revision)) throw new Error("SNAPSHOT_REVISION_INVALID");
    return {
      schemaVersion: snapshot.schema_version,
      revision,
      updatedAt: snapshot.updated_at,
      data: snapshot.data,
    };
  }
  throw new Error("SNAPSHOT_ENVELOPE_INVALID");
}

function requireCollection(data, collection) {
  const value = data?.[collection];
  if (!Array.isArray(value)) throw new Error(`SNAPSHOT_COLLECTION_INVALID:${collection}`);
  return value;
}

function collectByIdentity(records, idField, collection) {
  const hashes = {};
  const recordsById = {};
  const duplicateIds = [];
  for (const record of records) {
    if (!record || typeof record !== "object") throw new Error(`SNAPSHOT_RECORD_INVALID:${collection}`);
    const id = record[idField];
    if (typeof id !== "string" || id.length === 0) throw new Error(`SNAPSHOT_RECORD_ID_INVALID:${collection}`);
    if (recordsById[id]) {
      duplicateIds.push(id);
      continue;
    }
    recordsById[id] = record;
    hashes[id] = sha256Utf8(stableJson(record));
  }
  return {
    hashes,
    recordsById,
    duplicateIds: sortedUnique(duplicateIds),
  };
}

function financialTotals(ledgerEntries, entitlements) {
  const sum = (entries, predicate) => entries
    .filter(predicate)
    .reduce((total, entry) => total + BigInt(entry.amountMinor || "0"), 0n);
  const earningMinor = sum(ledgerEntries, (entry) => entry.entryType === "earning");
  const reversalMinor = sum(ledgerEntries, (entry) => entry.entryType === "reversal");
  const entitlementsByState = {};
  for (const entitlement of entitlements) {
    const state = typeof entitlement.state === "string" ? entitlement.state : "unknown";
    if (!entitlementsByState[state]) {
      entitlementsByState[state] = { count: 0, amountMinor: "0" };
    }
    entitlementsByState[state].count += 1;
    entitlementsByState[state].amountMinor = (
      BigInt(entitlementsByState[state].amountMinor) + BigInt(entitlement.amountMinor || "0")
    ).toString();
  }
  return {
    earningMinor: earningMinor.toString(),
    reversalMinor: reversalMinor.toString(),
    netMinor: (earningMinor + reversalMinor).toString(),
    entitlementsByState,
  };
}

function referentialIntegrity(data) {
  const receipts = requireCollection(data, "sourceEventReceipts");
  const lines = requireCollection(data, "processedCommerceLines");
  const ledger = requireCollection(data, "ledgerEntries");
  const entitlements = requireCollection(data, "payoutEntitlements");
  const adjustments = requireCollection(data, "commerceAdjustments");

  const ledgerIds = new Set(ledger.map((entry) => entry.id).filter((id) => typeof id === "string"));
  const receiptIds = new Set(receipts.map((receipt) => receipt.sourceEventId).filter((id) => typeof id === "string"));
  const lineKeys = new Set(lines.map((line) => line.lineKey).filter((key) => typeof key === "string"));
  const earningLedgerIds = new Set(
    ledger
      .filter((entry) => entry.entryType === "earning" && typeof entry.id === "string")
      .map((entry) => entry.id),
  );

  const entitlementLedgerMissing = sortedUnique(
    entitlements
      .filter((entitlement) => !ledgerIds.has(entitlement.ledgerEntryId))
      .map((entitlement) => entitlement.entitlementId)
      .filter((id) => typeof id === "string"),
  );
  const processedMissingReceipt = sortedUnique(
    lines
      .filter((line) => !receiptIds.has(line.sourceEventId))
      .map((line) => line.lineKey)
      .filter((key) => typeof key === "string"),
  );
  const processedMissingLedger = sortedUnique(
    lines
      .filter((line) =>
        Array.isArray(line.ledgerEntryIds)
        && line.ledgerEntryIds.some((id) => !ledgerIds.has(id)))
      .map((line) => line.lineKey)
      .filter((key) => typeof key === "string"),
  );
  const adjustmentMissingReversal = sortedUnique(
    adjustments
      .filter((adjustment) =>
        Array.isArray(adjustment.reversalLedgerEntryIds)
        && adjustment.reversalLedgerEntryIds.some((id) => !ledgerIds.has(id)))
      .map((adjustment) => adjustment.adjustmentId)
      .filter((id) => typeof id === "string"),
  );
  const adjustmentMissingLine = sortedUnique(
    adjustments
      .filter((adjustment) =>
        Array.isArray(adjustment.lineRefunds)
        && adjustment.lineRefunds.some((lineRefund) => !lineKeys.has(lineRefund.lineKey)))
      .map((adjustment) => adjustment.adjustmentId)
      .filter((id) => typeof id === "string"),
  );
  const reversalMissingSource = sortedUnique(
    ledger
      .filter((entry) => entry.entryType === "reversal" && (!entry.sourceEntryId || !earningLedgerIds.has(entry.sourceEntryId)))
      .map((entry) => entry.id)
      .filter((id) => typeof id === "string"),
  );
  const entitlementLifecycleInvalid = sortedUnique(
    entitlements
      .filter((entitlement) => !ENTITLEMENT_STATES.has(entitlement.state))
      .map((entitlement) => entitlement.entitlementId)
      .filter((id) => typeof id === "string"),
  );
  const processedRuleAttributionInvalid = sortedUnique(
    lines
      .filter((line) => typeof line.ruleVersionId !== "string" || line.ruleVersionId.length === 0)
      .map((line) => line.lineKey)
      .filter((key) => typeof key === "string"),
  );

  return {
    entitlementLedgerMissing,
    processedMissingReceipt,
    processedMissingLedger,
    adjustmentMissingReversal,
    adjustmentMissingLine,
    reversalMissingSource,
    entitlementLifecycleInvalid,
    processedRuleAttributionInvalid,
  };
}

function collectInventory({ backend, envelope, rawSnapshotText }) {
  const data = envelope.data;
  const ids = {};
  const hashes = {};
  const duplicateIds = {};
  const recordsById = {};
  for (const collection of COLLECTIONS) {
    const records = requireCollection(data, collection);
    const gathered = collectByIdentity(records, ID_FIELDS[collection], collection);
    ids[collection] = Object.keys(gathered.recordsById).sort();
    hashes[collection] = gathered.hashes;
    recordsById[collection] = gathered.recordsById;
    duplicateIds[collection] = gathered.duplicateIds;
  }

  const ledgerEntries = requireCollection(data, "ledgerEntries");
  const idempotencyHashes = {};
  const duplicateIdempotency = [];
  const idempotencyRecords = {};
  for (const entry of ledgerEntries) {
    if (typeof entry.idempotencyKey !== "string" || entry.idempotencyKey.length === 0) {
      throw new Error("SNAPSHOT_LEDGER_IDEMPOTENCY_KEY_INVALID");
    }
    if (idempotencyRecords[entry.idempotencyKey]) {
      duplicateIdempotency.push(entry.idempotencyKey);
      continue;
    }
    idempotencyRecords[entry.idempotencyKey] = entry;
    idempotencyHashes[entry.idempotencyKey] = sha256Utf8(stableJson(entry));
  }
  ids.ledgerIdempotencyKeys = Object.keys(idempotencyRecords).sort();
  hashes.ledgerByIdempotencyKey = idempotencyHashes;
  duplicateIds.ledgerIdempotencyKeys = sortedUnique(duplicateIdempotency);
  recordsById.ledgerByIdempotencyKey = idempotencyRecords;

  const canonicalData = stableJson(data);
  const rawHash = rawSnapshotText ? sha256Buffer(Buffer.from(rawSnapshotText, "utf8")) : sha256Utf8(stableJson(envelope));
  return {
    backend,
    namespace: "share-to-grow-repository",
    schemaVersion: envelope.schemaVersion,
    revision: envelope.revision,
    updatedAt: envelope.updatedAt,
    sourceSnapshotSha256: rawHash,
    canonicalDataSha256: sha256Utf8(canonicalData),
    counts: Object.fromEntries(COLLECTIONS.map((collection) => [collection, ids[collection].length])),
    ids,
    hashes,
    duplicateIds,
    referentialIntegrity: referentialIntegrity(data),
    financialTotals: financialTotals(
      requireCollection(data, "ledgerEntries"),
      requireCollection(data, "payoutEntitlements"),
    ),
    _recordsById: recordsById,
  };
}

function compareHashMaps(leftMap, rightMap) {
  const leftIds = sortedUnique(Object.keys(leftMap));
  const rightIds = sortedUnique(Object.keys(rightMap));
  const rightSet = new Set(rightIds);
  const leftSet = new Set(leftIds);
  const exactDuplicates = [];
  const conflictingSameIdentity = [];
  const uniqueToLeft = [];
  const uniqueToRight = [];
  for (const id of leftIds) {
    if (!rightSet.has(id)) {
      uniqueToLeft.push(id);
      continue;
    }
    if (leftMap[id] === rightMap[id]) exactDuplicates.push(id);
    else conflictingSameIdentity.push(id);
  }
  for (const id of rightIds) {
    if (!leftSet.has(id)) uniqueToRight.push(id);
  }
  return {
    exactDuplicates,
    uniqueToPostgres: uniqueToLeft,
    uniqueToFilesystem: uniqueToRight,
    conflictingSameIdentity,
  };
}

function compareInventories(postgres, filesystem) {
  const collision = {};
  for (const collection of [...COLLECTIONS, "ledgerByIdempotencyKey"]) {
    collision[collection] = compareHashMaps(postgres.hashes[collection], filesystem.hashes[collection]);
  }
  return collision;
}

function mergedCollectionCount(collisionEntry) {
  if (collisionEntry.conflictingSameIdentity.length > 0) return null;
  return collisionEntry.exactDuplicates.length
    + collisionEntry.uniqueToPostgres.length
    + collisionEntry.uniqueToFilesystem.length;
}

function mergeFinancialTotals(postgres, filesystem, collision) {
  const mergedLedgerIds = [
    ...collision.ledgerEntries.exactDuplicates,
    ...collision.ledgerEntries.uniqueToPostgres,
    ...collision.ledgerEntries.uniqueToFilesystem,
  ];
  const mergedEntitlementIds = [
    ...collision.payoutEntitlements.exactDuplicates,
    ...collision.payoutEntitlements.uniqueToPostgres,
    ...collision.payoutEntitlements.uniqueToFilesystem,
  ];
  const ledgerLookup = {
    ...filesystem._recordsById.ledgerEntries,
    ...postgres._recordsById.ledgerEntries,
  };
  const entitlementLookup = {
    ...filesystem._recordsById.payoutEntitlements,
    ...postgres._recordsById.payoutEntitlements,
  };
  const mergedLedger = mergedLedgerIds.map((id) => ledgerLookup[id]).filter(Boolean);
  const mergedEntitlements = mergedEntitlementIds.map((id) => entitlementLookup[id]).filter(Boolean);
  return financialTotals(mergedLedger, mergedEntitlements);
}

function hasReferentialIssues(integrity) {
  return Object.values(integrity).some((value) => Array.isArray(value) && value.length > 0);
}

function collectBlockingConditions(postgres, filesystem, collision) {
  const blockingConditions = [];
  for (const [collection, duplicates] of Object.entries(postgres.duplicateIds)) {
    if (duplicates.length > 0) {
      blockingConditions.push({
        code: "POSTGRES_DUPLICATE_ID_IN_SNAPSHOT",
        collection,
        identities: duplicates,
      });
    }
  }
  for (const [collection, duplicates] of Object.entries(filesystem.duplicateIds)) {
    if (duplicates.length > 0) {
      blockingConditions.push({
        code: "FILESYSTEM_DUPLICATE_ID_IN_SNAPSHOT",
        collection,
        identities: duplicates,
      });
    }
  }
  for (const [collection, classification] of Object.entries(collision)) {
    if (classification.conflictingSameIdentity.length > 0) {
      blockingConditions.push({
        code: "CONFLICTING_SAME_IDENTITY",
        collection,
        identities: classification.conflictingSameIdentity,
      });
    }
  }
  if (hasReferentialIssues(postgres.referentialIntegrity)) {
    blockingConditions.push({
      code: "POSTGRES_REFERENTIAL_INTEGRITY_INVALID",
      details: postgres.referentialIntegrity,
    });
  }
  if (hasReferentialIssues(filesystem.referentialIntegrity)) {
    blockingConditions.push({
      code: "FILESYSTEM_REFERENTIAL_INTEGRITY_INVALID",
      details: filesystem.referentialIntegrity,
    });
  }
  return blockingConditions;
}

function summarizeCollisionCounts(collision) {
  return Object.fromEntries(Object.entries(collision).map(([collection, classification]) => [
    collection,
    {
      exactDuplicates: classification.exactDuplicates.length,
      uniqueToPostgres: classification.uniqueToPostgres.length,
      uniqueToFilesystem: classification.uniqueToFilesystem.length,
      conflictingSameIdentity: classification.conflictingSameIdentity.length,
    },
  ]));
}

function stripPrivateFields(inventory) {
  const { _recordsById, ...rest } = inventory;
  return rest;
}

export function buildDryRunReconciliationManifest(input) {
  if (!input || typeof input !== "object") throw new Error("RECONCILIATION_INPUT_INVALID");
  const postgresEnvelope = toEnvelope(input.postgresSnapshot);
  const filesystemEnvelope = toEnvelope(input.filesystemSnapshot);
  const postgres = collectInventory({
    backend: "postgres",
    envelope: postgresEnvelope,
    rawSnapshotText: input.postgresRawSnapshotText,
  });
  const filesystem = collectInventory({
    backend: "filesystem",
    envelope: filesystemEnvelope,
    rawSnapshotText: input.filesystemRawSnapshotText,
  });
  const collision = compareInventories(postgres, filesystem);
  const blockingConditions = collectBlockingConditions(postgres, filesystem, collision);
  const expectedMergedCounts = Object.fromEntries([
    ...COLLECTIONS.map((collection) => [collection, mergedCollectionCount(collision[collection])]),
    ["ledgerByIdempotencyKey", mergedCollectionCount(collision.ledgerByIdempotencyKey)],
  ]);

  const manifest = {
    manifestVersion: 1,
    mode: "DRY_RUN_ONLY",
    namespace: "share-to-grow-repository",
    generatedAt: input.generatedAt ?? "UNSPECIFIED",
    sourceSnapshots: {
      postgres: stripPrivateFields(postgres),
      filesystem: stripPrivateFields(filesystem),
    },
    collisionCounts: summarizeCollisionCounts(collision),
    collision,
    expectedMergedCounts,
    expectedMergedFinancialTotals: mergeFinancialTotals(postgres, filesystem, collision),
    proposedInsertOrder: PROPOSED_INSERT_ORDER,
    blockingConditions,
    readyToApply: blockingConditions.length === 0,
  };
  const canonicalManifest = stableJson(manifest);
  return {
    ...manifest,
    canonicalManifestSha256: sha256Utf8(canonicalManifest),
    canonicalManifest,
  };
}

async function loadSnapshot(path) {
  const raw = await readFile(path, "utf8");
  return {
    raw,
    parsed: JSON.parse(raw),
  };
}

function usage() {
  throw new Error(
    "Usage: node scripts/share-to-grow-reconciliation-dry-run.mjs --postgres-snapshot <path> --filesystem-snapshot <path>",
  );
}

function parseCliArguments(argv) {
  const valueAfter = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const postgresSnapshot = valueAfter("--postgres-snapshot");
  const filesystemSnapshot = valueAfter("--filesystem-snapshot");
  if (!postgresSnapshot || !filesystemSnapshot) usage();
  return { postgresSnapshot, filesystemSnapshot };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const { postgresSnapshot, filesystemSnapshot } = parseCliArguments(process.argv.slice(2));
  const postgres = await loadSnapshot(postgresSnapshot);
  const filesystem = await loadSnapshot(filesystemSnapshot);
  const manifest = buildDryRunReconciliationManifest({
    generatedAt: new Date().toISOString(),
    postgresSnapshot: postgres.parsed,
    filesystemSnapshot: filesystem.parsed,
    postgresRawSnapshotText: postgres.raw,
    filesystemRawSnapshotText: filesystem.raw,
  });
  console.log(JSON.stringify(manifest, null, 2));
}
