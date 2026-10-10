import type { AttributionDecision } from "./attribution";
import type { ProcessedCommerceLine } from "./allocation-pipeline";
import type { PayoutEntitlement } from "./payout";
import { commitProcessedCommerceLines } from "./share-to-grow-repository";
import type { EconomicRuleVersion } from "./economic-rule";
import {
  serializeRuleVersion,
  type PersistedPayoutEntitlement,
  type ProcessedCommerceLineRecord,
} from "./persistence-types";

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

export async function persistProcessedCommerceLines(input: {
  readonly sourceEventId: string;
  readonly saleMerchandiseMinor: readonly (string | undefined)[];
  readonly ruleSnapshots: readonly EconomicRuleVersion[];
  readonly organizationId: string;
  readonly processedAt: string;
  readonly processedLines: readonly ProcessedCommerceLine[];
  readonly attribution: AttributionDecision;
  readonly entitlements: readonly PayoutEntitlement[];
  readonly sourceEventReceipt: import("./persistence-types").SourceEventReceiptRecord;
  readonly expectedRevision: number;
}): Promise<{ records: readonly ProcessedCommerceLineRecord[]; replay: boolean }> {
  if (
    input.saleMerchandiseMinor.length !== input.processedLines.length
    || input.ruleSnapshots.length !== input.processedLines.length
  ) {
    throw new Error("SHARE_TO_GROW_PERSISTENCE_INPUT_MISMATCH");
  }
  const records = input.processedLines.map((processedLine, index) => ({
    lineKey: processedLine.lineKey,
    sourceEventId: input.sourceEventId,
    organizationId: input.organizationId,
    attribution: input.attribution,
    ruleVersionId: processedLine.ruleVersionId,
    ledgerEntryIds: Object.freeze(processedLine.ledgerEntries.map((entry) => entry.id)),
    processedAt: input.processedAt,
    ruleSnapshot: serializeRuleVersion(input.ruleSnapshots[index]),
    ...(input.saleMerchandiseMinor[index] !== undefined
      ? { saleMerchandiseMinor: input.saleMerchandiseMinor[index] }
      : {}),
  }));
  return commitProcessedCommerceLines({
    records,
    ledgerEntries: input.processedLines.flatMap((line) => line.ledgerEntries),
    payoutEntitlements: input.entitlements.map(persistEntitlement),
    sourceEventReceipt: input.sourceEventReceipt,
    expectedRevision: input.expectedRevision,
  });
}