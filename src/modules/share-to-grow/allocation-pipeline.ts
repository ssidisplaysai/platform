import type { AttributionDecision } from "./attribution";
import {
  allocateByRule,
  type EconomicAllocation,
  type EconomicRuleVersion,
} from "./economic-rule";
import { AppendOnlyLedger, type LedgerEntry } from "./ledger";
import type { NormalizedCommerceLine } from "./commerce";

export interface EconomicRuleResolver {
  resolve(input: {
    line: NormalizedCommerceLine;
    attribution: AttributionDecision;
  }): EconomicRuleVersion;
}

export interface ProcessedCommerceLine {
  readonly lineKey: string;
  readonly attribution: AttributionDecision;
  readonly ruleVersionId: string;
  readonly allocations: readonly EconomicAllocation[];
  readonly ledgerEntries: readonly LedgerEntry[];
}

export function allocateCommerceLine(input: {
  line: NormalizedCommerceLine;
  attribution: AttributionDecision;
  ruleResolver: EconomicRuleResolver;
  ledger: AppendOnlyLedger;
  postedAt: string;
}): ProcessedCommerceLine {
  const rule = input.ruleResolver.resolve({
    line: input.line,
    attribution: input.attribution,
  });

  const allocations = allocateByRule(
    input.line.distributableMerchandiseProfit,
    rule,
  );

  const ledgerEntries = allocations.map((allocation, index) =>
    input.ledger.post({
      id: `earning:${input.line.lineKey}:${rule.id}:${allocation.beneficiaryId}`,
      idempotencyKey: `earning:${input.line.lineKey}:${rule.id}:${allocation.beneficiaryId}`,
      beneficiaryId: allocation.beneficiaryId,
      allocationId: `${input.line.lineKey}:${rule.id}:${index}`,
      entryType: "earning",
      amount: allocation.amount,
      postedAt: input.postedAt,
    }),
  );

  const ledgerTotal = ledgerEntries.reduce(
    (sum, entry) => sum + entry.amount.minor,
    BigInt(0),
  );
  if (ledgerTotal !== input.line.distributableMerchandiseProfit.minor) {
    throw new Error("LEDGER_DMP_RECONCILIATION_FAILED");
  }

  return Object.freeze({
    lineKey: input.line.lineKey,
    attribution: input.attribution,
    ruleVersionId: rule.id,
    allocations,
    ledgerEntries: Object.freeze(ledgerEntries),
  });
}
