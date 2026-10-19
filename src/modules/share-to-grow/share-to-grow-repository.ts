import {
  deepClone,
  FoundationPersistenceConflictError,
} from "../foundation/foundation-persistence";
import {
  getFoundationStateStore,
  type FoundationStateLoad,
} from "../foundation/foundation-state-store";
import { validateRuleVersion, type EconomicRuleVersion } from "./economic-rule";
import type { LedgerEntry } from "./ledger";
import { reversedEntitlementState } from "./payout";
import {
  deserializeRuleVersion,
  serializeLedgerEntry,
  serializeRuleVersion,
  type CollaborationParticipantRecord,
  type PersistedLedgerEntry,
  type CommerceAdjustmentRecord,
  type PersistedPayoutEntitlement,
  type ProcessedCommerceLineRecord,
  type ShareToGrowRepositoryState,
  type SourceEventReceiptRecord,
  type TrackingIdentityReferenceRecord,
} from "./persistence-types";

const PERSISTENCE_NAMESPACE = "share-to-grow-repository";

function createSeedState(): ShareToGrowRepositoryState {
  return {
    participants: [],
    trackingIdentities: [],
    ruleVersions: [],
    ledgerEntries: [],
    sourceEventReceipts: [],
    processedCommerceLines: [],
    payoutEntitlements: [],
    commerceAdjustments: [],
  };
}

export type ShareToGrowRepositorySnapshot = FoundationStateLoad<ShareToGrowRepositoryState>;

export async function loadShareToGrowRepositorySnapshot(): Promise<ShareToGrowRepositorySnapshot> {
  const loaded = await getFoundationStateStore().load<ShareToGrowRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  return {
    ...loaded,
    // State persisted before adjustment support has no commerceAdjustments collection.
    state: { ...createSeedState(), ...deepClone(loaded.state) },
  };
}

async function persistCurrentState(
  nextState: ShareToGrowRepositoryState,
  expectedRevision: number,
): Promise<number> {
  const saved = await getFoundationStateStore().save({
    namespace: PERSISTENCE_NAMESPACE,
    state: nextState,
    expectedRevision,
  });
  return saved.revision;
}

export async function reloadShareToGrowRepositoryFromPersistence(): Promise<void> {
  await loadShareToGrowRepositorySnapshot();
}

export async function resetShareToGrowRepositoryForTests(): Promise<void> {
  await getFoundationStateStore().reset({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
}

export async function listCollaborationParticipants(): Promise<readonly CollaborationParticipantRecord[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.participants.map((participant) => deepClone(participant));
}

export async function registerCollaborationParticipant(
  participant: CollaborationParticipantRecord,
): Promise<CollaborationParticipantRecord> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const existing = snapshot.state.participants.find(
    (candidate) => candidate.participantId === participant.participantId,
  );
  if (existing) return deepClone(existing);

  if (
    participant.role === "creator" &&
    participant.sponsorPartnerId &&
    snapshot.state.participants.some(
      (candidate) =>
        candidate.canonicalPartnerId === participant.sponsorPartnerId &&
        candidate.role === "creator",
    )
  ) {
    throw new Error("CREATOR_DOWNLINE_DEPTH_EXCEEDED");
  }

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    participants: [...snapshot.state.participants, deepClone(participant)],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return deepClone(participant);
}

export async function listTrackingIdentityReferences(): Promise<readonly TrackingIdentityReferenceRecord[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.trackingIdentities.map((identity) => deepClone(identity));
}

export async function registerTrackingIdentityReference(
  identity: TrackingIdentityReferenceRecord,
): Promise<TrackingIdentityReferenceRecord> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const byId = snapshot.state.trackingIdentities.find(
    (candidate) => candidate.trackingIdentityId === identity.trackingIdentityId,
  );
  if (byId) return deepClone(byId);

  const slugConflict = snapshot.state.trackingIdentities.find(
    (candidate) =>
      candidate.organizationId === identity.organizationId &&
      candidate.publicSlug === identity.publicSlug,
  );
  if (slugConflict) throw new Error("TRACKING_PUBLIC_SLUG_CONFLICT");

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    trackingIdentities: [...snapshot.state.trackingIdentities, deepClone(identity)],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return deepClone(identity);
}

export async function listEconomicRuleVersions(): Promise<readonly EconomicRuleVersion[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.ruleVersions.map(deserializeRuleVersion);
}

export async function registerEconomicRuleVersion(
  rule: EconomicRuleVersion,
): Promise<EconomicRuleVersion> {
  validateRuleVersion(rule);
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const existing = snapshot.state.ruleVersions.find((candidate) => candidate.id === rule.id);
  if (existing) return deserializeRuleVersion(existing);

  const duplicateVersion = snapshot.state.ruleVersions.find(
    (candidate) =>
      candidate.ruleId === rule.ruleId && candidate.version === rule.version,
  );
  if (duplicateVersion) throw new Error("ECONOMIC_RULE_VERSION_EXISTS");

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    ruleVersions: [...snapshot.state.ruleVersions, serializeRuleVersion(rule)],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return deserializeRuleVersion(serializeRuleVersion(rule));
}

export async function listPersistedLedgerEntries(): Promise<readonly PersistedLedgerEntry[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.ledgerEntries.map((entry) => deepClone(entry));
}

export async function postPersistedLedgerEntry(entry: LedgerEntry): Promise<PersistedLedgerEntry> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const replay = snapshot.state.ledgerEntries.find(
    (candidate) => candidate.idempotencyKey === entry.idempotencyKey,
  );
  if (replay) return deepClone(replay);

  if (snapshot.state.ledgerEntries.some((candidate) => candidate.id === entry.id)) {
    throw new Error("LEDGER_ENTRY_ID_EXISTS");
  }

  if (
    entry.entryType === "reversal" &&
    (!entry.sourceEntryId ||
      !snapshot.state.ledgerEntries.some((candidate) => candidate.id === entry.sourceEntryId))
  ) {
    throw new Error("REVERSAL_SOURCE_REQUIRED");
  }

  const persisted = serializeLedgerEntry(entry);
  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    ledgerEntries: [...snapshot.state.ledgerEntries, persisted],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return deepClone(persisted);
}


export async function listSourceEventReceipts(): Promise<readonly SourceEventReceiptRecord[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.sourceEventReceipts.map((receipt) => deepClone(receipt));
}

export async function recordSourceEventReceipt(
  receipt: SourceEventReceiptRecord,
  expectedRevision?: number,
): Promise<{ receipt: SourceEventReceiptRecord; replay: boolean }> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  if (expectedRevision !== undefined && snapshot.revision !== expectedRevision) {
    throw new FoundationPersistenceConflictError(
      `Revision conflict for ${PERSISTENCE_NAMESPACE}: expected ${expectedRevision}, found ${snapshot.revision}.`,
    );
  }
  const existing = snapshot.state.sourceEventReceipts.find(
    (candidate) => candidate.sourceEventId === receipt.sourceEventId,
  );
  if (existing) {
    if (
      existing.source !== receipt.source ||
      existing.eventType !== receipt.eventType ||
      existing.payloadHash !== receipt.payloadHash
    ) {
      throw new Error("SOURCE_EVENT_ID_COLLISION");
    }
    return { receipt: deepClone(existing), replay: true };
  }

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    sourceEventReceipts: [...snapshot.state.sourceEventReceipts, deepClone(receipt)],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return { receipt: deepClone(receipt), replay: false };
}

export async function listProcessedCommerceLines(): Promise<readonly ProcessedCommerceLineRecord[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.processedCommerceLines.map((record) => deepClone(record));
}

export async function listPersistedPayoutEntitlements(): Promise<readonly PersistedPayoutEntitlement[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.payoutEntitlements.map((record) => deepClone(record));
}

export async function persistProcessedCommerceLine(input: {
  record: ProcessedCommerceLineRecord;
  ledgerEntries: readonly LedgerEntry[];
  payoutEntitlements: readonly PersistedPayoutEntitlement[];
}): Promise<{ record: ProcessedCommerceLineRecord; replay: boolean }> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const existing = snapshot.state.processedCommerceLines.find(
    (candidate) => candidate.lineKey === input.record.lineKey,
  );
  if (existing) {
    if (existing.ruleVersionId !== input.record.ruleVersionId) {
      throw new Error("PROCESSED_COMMERCE_LINE_COLLISION");
    }
    return { record: deepClone(existing), replay: true };
  }

  const nextLedger = [...snapshot.state.ledgerEntries];
  for (const entry of input.ledgerEntries) {
    const persisted = serializeLedgerEntry(entry);
    const byKey = nextLedger.find(
      (candidate) => candidate.idempotencyKey === persisted.idempotencyKey,
    );
    if (byKey) continue;
    if (nextLedger.some((candidate) => candidate.id === persisted.id)) {
      throw new Error("LEDGER_ENTRY_ID_EXISTS");
    }
    nextLedger.push(persisted);
  }

  const nextEntitlements = [...snapshot.state.payoutEntitlements];
  for (const entitlement of input.payoutEntitlements) {
    const existingEntitlement = nextEntitlements.find(
      (candidate) => candidate.entitlementId === entitlement.entitlementId,
    );
    if (existingEntitlement) continue;
    nextEntitlements.push(deepClone(entitlement));
  }

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    ledgerEntries: nextLedger,
    payoutEntitlements: nextEntitlements,
    processedCommerceLines: [
      ...snapshot.state.processedCommerceLines,
      deepClone(input.record),
    ],
  };
  await persistCurrentState(nextState, snapshot.revision);
  return { record: deepClone(input.record), replay: false };
}

export async function commitProcessedCommerceLines(input: {
  readonly records: readonly ProcessedCommerceLineRecord[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly payoutEntitlements: readonly PersistedPayoutEntitlement[];
  readonly sourceEventReceipt: SourceEventReceiptRecord;
  readonly expectedRevision: number;
}): Promise<{ records: readonly ProcessedCommerceLineRecord[]; replay: boolean }> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  if (snapshot.revision !== input.expectedRevision) {
    throw new FoundationPersistenceConflictError(
      `Revision conflict for ${PERSISTENCE_NAMESPACE}: expected ${input.expectedRevision}, found ${snapshot.revision}.`,
    );
  }

  const receipt = snapshot.state.sourceEventReceipts.find(
    (candidate) => candidate.sourceEventId === input.sourceEventReceipt.sourceEventId,
  );
  if (receipt) {
    if (
      receipt.source !== input.sourceEventReceipt.source
      || receipt.eventType !== input.sourceEventReceipt.eventType
      || receipt.payloadHash !== input.sourceEventReceipt.payloadHash
    ) {
      throw new Error("SOURCE_EVENT_ID_COLLISION");
    }
    return { records: input.records.map(deepClone), replay: true };
  }

  const existingLines = new Map(
    snapshot.state.processedCommerceLines.map((record) => [record.lineKey, record]),
  );
  const recordsToAppend = input.records.filter((record) => {
    const existing = existingLines.get(record.lineKey);
    if (!existing) return true;
    if (existing.ruleVersionId !== record.ruleVersionId) {
      throw new Error("PROCESSED_COMMERCE_LINE_COLLISION");
    }
    return false;
  });

  const nextLedger = [...snapshot.state.ledgerEntries];
  for (const entry of input.ledgerEntries) {
    const persisted = serializeLedgerEntry(entry);
    if (nextLedger.some((candidate) => candidate.idempotencyKey === persisted.idempotencyKey)) continue;
    if (nextLedger.some((candidate) => candidate.id === persisted.id)) {
      throw new Error("LEDGER_ENTRY_ID_EXISTS");
    }
    nextLedger.push(persisted);
  }

  const nextEntitlements = [...snapshot.state.payoutEntitlements];
  for (const entitlement of input.payoutEntitlements) {
    if (nextEntitlements.some((candidate) => candidate.entitlementId === entitlement.entitlementId)) continue;
    nextEntitlements.push(deepClone(entitlement));
  }

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    sourceEventReceipts: [...snapshot.state.sourceEventReceipts, deepClone(input.sourceEventReceipt)],
    processedCommerceLines: [...snapshot.state.processedCommerceLines, ...recordsToAppend.map(deepClone)],
    ledgerEntries: nextLedger,
    payoutEntitlements: nextEntitlements,
  };
  await persistCurrentState(nextState, snapshot.revision);
  return { records: recordsToAppend.map(deepClone), replay: recordsToAppend.length === 0 };
}

export async function commitProcessedCommerceLine(input: {
  readonly record: ProcessedCommerceLineRecord;
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly payoutEntitlements: readonly PersistedPayoutEntitlement[];
}): Promise<{ record: ProcessedCommerceLineRecord; replay: boolean }> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const existing = snapshot.state.processedCommerceLines.find(
    (candidate) => candidate.lineKey === input.record.lineKey,
  );
  if (existing) return { record: deepClone(existing), replay: true };

  const nextLedgerEntries = [...snapshot.state.ledgerEntries];
  for (const entry of input.ledgerEntries) {
    const replay = nextLedgerEntries.find(
      (candidate) => candidate.idempotencyKey === entry.idempotencyKey,
    );
    if (replay) continue;
    if (nextLedgerEntries.some((candidate) => candidate.id === entry.id)) {
      throw new Error("LEDGER_ENTRY_ID_EXISTS");
    }
    nextLedgerEntries.push(serializeLedgerEntry(entry));
  }

  const nextEntitlements = [...snapshot.state.payoutEntitlements];
  for (const entitlement of input.payoutEntitlements) {
    const existingEntitlement = nextEntitlements.find(
      (candidate) => candidate.entitlementId === entitlement.entitlementId,
    );
    if (existingEntitlement) continue;
    nextEntitlements.push(deepClone(entitlement));
  }

  const nextState: ShareToGrowRepositoryState = {
    ...snapshot.state,
    ledgerEntries: nextLedgerEntries,
    processedCommerceLines: [...snapshot.state.processedCommerceLines, deepClone(input.record)],
    payoutEntitlements: nextEntitlements,
  };
  await persistCurrentState(nextState, snapshot.revision);
  return { record: deepClone(input.record), replay: false };
}

export async function listCommerceAdjustments(): Promise<readonly CommerceAdjustmentRecord[]> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  return snapshot.state.commerceAdjustments.map((record) => deepClone(record));
}

/**
 * Atomically appends an adjustment record, its reversal ledger entries and the
 * matching entitlement lifecycle transitions. Existing earnings are never
 * modified; entitlements already payable/paid cause the whole commit to fail.
 */
export async function commitCommerceAdjustment(input: {
  readonly record: CommerceAdjustmentRecord;
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly reversedEntitlementIds: readonly string[];
  readonly entitlementReductions?: ReadonlyArray<{ readonly entitlementId: string; readonly reduceMinor: string }>;
  readonly sourceEventReceipt?: SourceEventReceiptRecord;
  readonly expectedRevision?: number;
}): Promise<{ record: CommerceAdjustmentRecord; replay: boolean }> {
  const snapshot = await loadShareToGrowRepositorySnapshot();
  if (input.expectedRevision !== undefined && snapshot.revision !== input.expectedRevision) {
    throw new FoundationPersistenceConflictError(
      `Revision conflict for ${PERSISTENCE_NAMESPACE}: expected ${input.expectedRevision}, found ${snapshot.revision}.`,
    );
  }
  const existing = snapshot.state.commerceAdjustments.find(
    (candidate) => candidate.adjustmentId === input.record.adjustmentId,
  );
  if (existing) return { record: deepClone(existing), replay: true };

  const nextLedgerEntries = [...snapshot.state.ledgerEntries];
  for (const entry of input.ledgerEntries) {
    if (nextLedgerEntries.some((candidate) => candidate.idempotencyKey === entry.idempotencyKey)) continue;
    if (nextLedgerEntries.some((candidate) => candidate.id === entry.id)) {
      throw new Error("LEDGER_ENTRY_ID_EXISTS");
    }
    if (
      entry.entryType === "reversal" &&
      (!entry.sourceEntryId ||
        !nextLedgerEntries.some((candidate) => candidate.id === entry.sourceEntryId))
    ) {
      throw new Error("REVERSAL_SOURCE_REQUIRED");
    }
    nextLedgerEntries.push(serializeLedgerEntry(entry));
  }

  const reversedIds = new Set(input.reversedEntitlementIds);
  const reductions = new Map(
    (input.entitlementReductions ?? []).map((item) => [item.entitlementId, BigInt(item.reduceMinor)]),
  );
  const nextEntitlements = snapshot.state.payoutEntitlements.map((entitlement) => {
    if (reversedIds.has(entitlement.entitlementId)) {
      return { ...deepClone(entitlement), state: reversedEntitlementState(entitlement.state) };
    }
    const reduce = reductions.get(entitlement.entitlementId);
    if (reduce !== undefined) {
      if (entitlement.state === "payable" || entitlement.state === "paid") {
        throw new Error("ENTITLEMENT_NOT_REVERSIBLE");
      }
      const next = BigInt(entitlement.amountMinor) - reduce;
      if (next <= 0n) throw new Error("ENTITLEMENT_REDUCTION_INVALID");
      return { ...deepClone(entitlement), amountMinor: next.toString() };
    }
    return deepClone(entitlement);
  });

  const sourceEventReceipts = [...snapshot.state.sourceEventReceipts];
  if (input.sourceEventReceipt) {
    const receipt = sourceEventReceipts.find(
      (candidate) => candidate.sourceEventId === input.sourceEventReceipt?.sourceEventId,
    );
    if (receipt) {
      if (
        receipt.source !== input.sourceEventReceipt.source
        || receipt.eventType !== input.sourceEventReceipt.eventType
        || receipt.payloadHash !== input.sourceEventReceipt.payloadHash
      ) {
        throw new Error("SOURCE_EVENT_ID_COLLISION");
      }
    } else {
      sourceEventReceipts.push(deepClone(input.sourceEventReceipt));
    }
  }
  await persistCurrentState({
    ...snapshot.state,
    ledgerEntries: nextLedgerEntries,
    payoutEntitlements: nextEntitlements,
    sourceEventReceipts,
    commerceAdjustments: [...snapshot.state.commerceAdjustments, deepClone(input.record)],
  }, snapshot.revision);
  return { record: deepClone(input.record), replay: false };
}