import { Money, money } from "./money";

export interface BasisPointsBeneficiary {
  readonly beneficiaryId: string;
  readonly role: string;
  readonly basisPoints: number;
}

export interface EconomicRuleVersion {
  readonly id: string;
  readonly ruleId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly beneficiaries: readonly BasisPointsBeneficiary[];
  readonly residualBeneficiaryId: string;
}

export interface EconomicAllocation {
  readonly beneficiaryId: string;
  readonly role: string;
  readonly amount: Money;
}

export function validateRuleVersion(rule: EconomicRuleVersion): void {
  if (!rule.id || !rule.ruleId || rule.version < 1) {
    throw new Error("INVALID_RULE_IDENTITY");
  }
  if (rule.beneficiaries.length === 0) {
    throw new Error("BENEFICIARIES_REQUIRED");
  }

  const ids = new Set<string>();
  let total = 0;
  for (const beneficiary of rule.beneficiaries) {
    if (!beneficiary.beneficiaryId || ids.has(beneficiary.beneficiaryId)) {
      throw new Error("INVALID_BENEFICIARY");
    }
    if (!Number.isInteger(beneficiary.basisPoints) || beneficiary.basisPoints < 0) {
      throw new Error("INVALID_BASIS_POINTS");
    }
    ids.add(beneficiary.beneficiaryId);
    total += beneficiary.basisPoints;
  }

  if (total !== 10_000) throw new Error("RULE_MUST_TOTAL_100_PERCENT");
  if (!ids.has(rule.residualBeneficiaryId)) {
    throw new Error("RESIDUAL_BENEFICIARY_REQUIRED");
  }
}

export function allocateByRule(
  distributableProfit: Money,
  rule: EconomicRuleVersion,
): readonly EconomicAllocation[] {
  validateRuleVersion(rule);

  let allocated = 0n;
  const allocations = rule.beneficiaries.map((beneficiary) => {
    const amountMinor =
      (distributableProfit.minor * BigInt(beneficiary.basisPoints)) / 10_000n;
    allocated += amountMinor;
    return {
      beneficiaryId: beneficiary.beneficiaryId,
      role: beneficiary.role,
      amount: money(amountMinor, distributableProfit.currency),
    };
  });

  const residual = distributableProfit.minor - allocated;
  const residualIndex = allocations.findIndex(
    (allocation) => allocation.beneficiaryId === rule.residualBeneficiaryId,
  );
  const current = allocations[residualIndex];
  allocations[residualIndex] = {
    ...current,
    amount: money(current.amount.minor + residual, distributableProfit.currency),
  };

  const reconciled = allocations.reduce((sum, item) => sum + item.amount.minor, 0n);
  if (reconciled !== distributableProfit.minor) {
    throw new Error("ALLOCATION_RECONCILIATION_FAILED");
  }

  return Object.freeze(allocations);
}
