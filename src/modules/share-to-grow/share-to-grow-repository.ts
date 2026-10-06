import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "../foundation/foundation-persistence";
import { validateRuleVersion, type EconomicRuleVersion } from "./economic-rule";
import type { LedgerEntry } from "./ledger";
import {
  deserializeRuleVersion,
  serializeLedgerEntry,
  serializeRuleVersion,
  type CollaborationParticipantRecord,
  type PersistedLedgerEntry,
  type ShareToGrowRepositoryState,
  type TrackingIdentityReferenceRecord,
} from "./persistence-types";

const PERSISTENCE_NAMESPACE = "share-to-grow-repository";

function createSeedState(): ShareToGrowRepositoryState {
  return {
    participants: [],
    trackingIdentities: [],
    ruleVersions: [],
    ledgerEntries: [],
  };
}

let state: ShareToGrowRepositoryState = createSeedState();
let stateRevision = 0;

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<ShareToGrowRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  state = deepClone(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(nextState: ShareToGrowRepositoryState): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: nextState,
    expectedRevision: stateRevision,
  });
  state = deepClone(nextState);
  stateRevision = saved.revision;
}

loadStateFromPersistence();

export function reloadShareToGrowRepositoryFromPersistence(): void {
  loadStateFromPersistence();
}

export function resetShareToGrowRepositoryForTests(): void {
  const reset = resetPersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  state = deepClone(reset.state);
  stateRevision = reset.revision;
}

export function listCollaborationParticipants(): readonly CollaborationParticipantRecord[] {
  return state.participants.map((participant) => deepClone(participant));
}

export function registerCollaborationParticipant(
  participant: CollaborationParticipantRecord,
): CollaborationParticipantRecord {
  const existing = state.participants.find(
    (candidate) => candidate.participantId === participant.participantId,
  );
  if (existing) return deepClone(existing);

  if (
    participant.role === "creator" &&
    participant.sponsorPartnerId &&
    state.participants.some(
      (candidate) =>
        candidate.canonicalPartnerId === participant.sponsorPartnerId &&
        candidate.role === "creator",
    )
  ) {
    throw new Error("CREATOR_DOWNLINE_DEPTH_EXCEEDED");
  }

  const nextState: ShareToGrowRepositoryState = {
    ...state,
    participants: [...state.participants, deepClone(participant)],
  };
  persistCurrentState(nextState);
  return deepClone(participant);
}

export function listTrackingIdentityReferences(): readonly TrackingIdentityReferenceRecord[] {
  return state.trackingIdentities.map((identity) => deepClone(identity));
}

export function registerTrackingIdentityReference(
  identity: TrackingIdentityReferenceRecord,
): TrackingIdentityReferenceRecord {
  const byId = state.trackingIdentities.find(
    (candidate) => candidate.trackingIdentityId === identity.trackingIdentityId,
  );
  if (byId) return deepClone(byId);

  const slugConflict = state.trackingIdentities.find(
    (candidate) =>
      candidate.organizationId === identity.organizationId &&
      candidate.publicSlug === identity.publicSlug,
  );
  if (slugConflict) throw new Error("TRACKING_PUBLIC_SLUG_CONFLICT");

  const nextState: ShareToGrowRepositoryState = {
    ...state,
    trackingIdentities: [...state.trackingIdentities, deepClone(identity)],
  };
  persistCurrentState(nextState);
  return deepClone(identity);
}

export function listEconomicRuleVersions(): readonly EconomicRuleVersion[] {
  return state.ruleVersions.map(deserializeRuleVersion);
}

export function registerEconomicRuleVersion(
  rule: EconomicRuleVersion,
): EconomicRuleVersion {
  validateRuleVersion(rule);
  const existing = state.ruleVersions.find((candidate) => candidate.id === rule.id);
  if (existing) return deserializeRuleVersion(existing);

  const duplicateVersion = state.ruleVersions.find(
    (candidate) =>
      candidate.ruleId === rule.ruleId && candidate.version === rule.version,
  );
  if (duplicateVersion) throw new Error("ECONOMIC_RULE_VERSION_EXISTS");

  const nextState: ShareToGrowRepositoryState = {
    ...state,
    ruleVersions: [...state.ruleVersions, serializeRuleVersion(rule)],
  };
  persistCurrentState(nextState);
  return deserializeRuleVersion(serializeRuleVersion(rule));
}

export function listPersistedLedgerEntries(): readonly PersistedLedgerEntry[] {
  return state.ledgerEntries.map((entry) => deepClone(entry));
}

export function postPersistedLedgerEntry(entry: LedgerEntry): PersistedLedgerEntry {
  const replay = state.ledgerEntries.find(
    (candidate) => candidate.idempotencyKey === entry.idempotencyKey,
  );
  if (replay) return deepClone(replay);

  if (state.ledgerEntries.some((candidate) => candidate.id === entry.id)) {
    throw new Error("LEDGER_ENTRY_ID_EXISTS");
  }

  if (
    entry.entryType === "reversal" &&
    (!entry.sourceEntryId ||
      !state.ledgerEntries.some((candidate) => candidate.id === entry.sourceEntryId))
  ) {
    throw new Error("REVERSAL_SOURCE_REQUIRED");
  }

  const persisted = serializeLedgerEntry(entry);
  const nextState: ShareToGrowRepositoryState = {
    ...state,
    ledgerEntries: [...state.ledgerEntries, persisted],
  };
  persistCurrentState(nextState);
  return deepClone(persisted);
}
