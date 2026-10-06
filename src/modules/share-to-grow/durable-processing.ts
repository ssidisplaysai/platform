import type { AttributionDecision } from "./attribution";
import type { ProcessedCommerceLine } from "./allocation-pipeline";
import type { PayoutEntitlement } from "./payout";
import {
  commitProcessedCommerceLine,
  type,
} from "./share-to-grow-repository";
import type { PersistedPayoutEntitlement, ProcessedCommerceLineRecord } from "./persistence-types";

function persistEntitlement(entitlement: PayoutEntitlement): PersistedPayoutEntitlement {
  return {
    entitlementId: entitlement.entitlementId,
    beneficiaryId: entitlement.beneficiaryId,
    currency: entitlement.currency,
    ledgerEntryId: entitlement.ledgerEntryId,
    amountMinor: entitlement.amountMinor.toString(),
    state: entitlement.state,
    earnedAt: entitlement.earnedAt,
    clearsAt: entitlement.clearsAt,
    statementId: entitlement.statementId,
    paidReference: entitlement.paidReference,
  };
}

export function persistProcessedCommerceLine(input: {
  readonly sourceEventId: string;
  readonly organizationId: string;
  readonly processedAt: string;
  readonly processedLine: ProcessedCommerceLine;
  readonly attribution: AttributionDecision;
  readonly entitlements: readonly PayoutEntitlement[];
}): { record: ProcessedCommerceLineRecord; replay: boolean } {
  const ledgerEntryIds = input.processedLine.ledgerEntries.map((entry) => entry.id);
  const record: ProcessedCommerceLineRecord = {
    lineKey: input.processedLine.lineKey,
    sourceEventId: input.sourceEventId,
    organizationId: input.organizationId,
    attribution: input.attribution,
    ruleVersionId: input.processedLine.ruleVersionId,
    ledgerEntryIds: Object.freeze(ledgerEntryIds),
    processedAt: input.processedAt,
  };

  return commitProcessedCommerceLine({
    record,
    ledgerEntries: input.processedLine.ledgerEntries,
    payoutEntitlements: input.entitlements.map(persistEntitlement),
  });
}