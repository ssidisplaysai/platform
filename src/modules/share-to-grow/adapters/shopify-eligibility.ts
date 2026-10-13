export const SHOPIFY_ELIGIBLE_FINANCIAL_STATUSES = Object.freeze(["paid", "partially_paid"]);

export type ShopifyEligibilityReason =
  | "ELIGIBLE_PAID_ORDER"
  | "ORDER_NOT_PAID"
  | "ORDER_CANCELLED"
  | "ORDER_TOTAL_INVALID";

export interface ShopifyOrderEligibilityFacts {
  readonly orderId: string;
  readonly financialStatus: string | null;
  readonly cancelledAt: string | null;
  readonly paidAt: string | null;
  readonly totalMinor: bigint | null;
}

export interface ShopifyOrderEligibility {
  readonly eligible: boolean;
  readonly reason: ShopifyEligibilityReason;
  readonly orderId: string;
  readonly financialStatus: string | null;
  readonly paidAt: string | null;
}

export function evaluateShopifyOrderEligibility(
  facts: ShopifyOrderEligibilityFacts,
): ShopifyOrderEligibility {
  const paidAt = facts.paidAt !== null && Number.isFinite(Date.parse(facts.paidAt))
    ? facts.paidAt
    : null;
  const result = (eligible: boolean, reason: ShopifyEligibilityReason) =>
    Object.freeze({
      eligible,
      reason,
      orderId: facts.orderId,
      financialStatus: facts.financialStatus,
      paidAt,
    });

  if (facts.cancelledAt !== null) return result(false, "ORDER_CANCELLED");
  if (facts.financialStatus === null || !SHOPIFY_ELIGIBLE_FINANCIAL_STATUSES.includes(facts.financialStatus)) {
    return result(false, "ORDER_NOT_PAID");
  }
  if (paidAt === null) return result(false, "ORDER_NOT_PAID");
  if (facts.totalMinor === null || facts.totalMinor <= 0n) return result(false, "ORDER_TOTAL_INVALID");
  return result(true, "ELIGIBLE_PAID_ORDER");
}
