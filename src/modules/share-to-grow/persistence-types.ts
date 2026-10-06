import type { EconomicRuleVersion } from "./economic-rule";
import type { LedgerEntry } from "./ledger";

export interface CollaborationParticipantRecord {
  readonly participantId: string;
  readonly organizationId: string;
  readonly collaborationId: string;
  readonly canonicalPartnerId: string;
  readonly role: "founding_collaborator" | "creator" | "brand";
  readonly sponsorPartnerId?: string;
  readonly status: "active" | "inactive" | "suspended";
  readonly createdAt: string;
}

export interface TrackingIdentityReferenceRecord {
  readonly trackingIdentityId: string;
  readonly organizationId: string;
  readonly canonicalPartnerId: string;
  readonly canonicalPartnerQrId: string;
  readonly publicSlug: string;
  readonly status: "active" | "inactive" | "expired";
  readonly createdAt: string;
}

export interface PersistedEconomicRuleVersion {
  readonly id: string;
  readonly ruleId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly beneficiaries: ReadonlyArray<{
    readonly beneficiaryId: string;
    readonly role: string;
    readonly basisPoints: number;
  }>;
  readonly residualBeneficiaryId: string;
}

export interface PersistedLedgerEntry {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly beneficiaryId: string;
  readonly allocationId?: string;
  readonly entryType: LedgerEntry["entryType"];
  readonly amountMinor: string;
  readonly currency: string;
  readonly sourceEntryId?: string;
  readonly postedAt: string;
}

export interface SourceEventReceiptRecord {
  readonly sourceEventId: string;
  readonly source: string;
  readonly eventType: string;
  readonly payloadHash: string;
  readonly receivedAt: string;
}

export interface ShareToGrowRepositoryState {
  readonly participants: CollaborationParticipantRecord[];
  readonly trackingIdentities: TrackingIdentityReferenceRecord[];
  readonly ruleVersions: PersistedEconomicRuleVersion[];
  readonly ledgerEntries: PersistedLedgerEntry[];
  readonly sourceEventReceipts: SourceEventReceiptRecord[];
}

export function serializeRuleVersion(
  rule: EconomicRuleVersion,
): PersistedEconomicRuleVersion {
  return {
    id: rule.id,
    ruleId: rule.ruleId,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    beneficiaries: rule.beneficiaries.map((beneficiary) => ({ ...beneficiary })),
    residualBeneficiaryId: rule.residualBeneficiaryId,
  };
}

export function deserializeRuleVersion(
  rule: PersistedEconomicRuleVersion,
): EconomicRuleVersion {
  return Object.freeze({
    ...rule,
    beneficiaries: Object.freeze(rule.beneficiaries.map((beneficiary) => Object.freeze({ ...beneficiary }))),
  });
}

export function serializeLedgerEntry(entry: LedgerEntry): PersistedLedgerEntry {
  return {
    id: entry.id,
    idempotencyKey: entry.idempotencyKey,
    beneficiaryId: entry.beneficiaryId,
    allocationId: entry.allocationId,
    entryType: entry.entryType,
    amountMinor: entry.amount.minor.toString(),
    currency: entry.amount.currency,
    sourceEntryId: entry.sourceEntryId,
    postedAt: entry.postedAt,
  };
}
