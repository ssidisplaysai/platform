/**
 * Economic eligibility for WooCommerce order events.
 *
 * Approved economically eligible Woo statuses (explicit allow-list):
 *   - processing  (payment received, awaiting fulfilment)
 *   - completed   (payment received, fulfilled)
 *
 * Everything else is ineligible, including pending, on-hold, failed,
 * cancelled, refunded, trash, draft, checkout-draft and any unknown status.
 * A status alone never proves payment: a valid `date_paid_gmt` is also
 * required, the order total must be a positive amount, and an order that
 * already carries refunds is not processed (refund policy is handled by the
 * refund path, not by first-time earnings creation).
 */
export const WOOCOMMERCE_ELIGIBLE_ORDER_STATUSES = Object.freeze(["processing", "completed"]);

export type WooCommerceEligibilityReason =
  | "ELIGIBLE_PAID_ORDER"
  | "ORDER_NOT_PAID"
  | "ORDER_STATUS_INELIGIBLE"
  | "ORDER_TOTAL_INVALID"
  | "ORDER_HAS_REFUNDS";

export interface WooCommerceOrderEligibilityFacts {
  readonly orderId: string;
  readonly status: string | null;
  readonly datePaidGmt: string | null;
  readonly totalMinor: bigint | null;
  readonly refundedMinor: bigint | null;
}

export interface WooCommerceOrderEligibility {
  readonly eligible: boolean;
  readonly reason: WooCommerceEligibilityReason;
  readonly orderId: string;
  readonly status: string | null;
  readonly paidAt: string | null;
}

export function evaluateWooCommerceOrderEligibility(
  facts: WooCommerceOrderEligibilityFacts,
): WooCommerceOrderEligibility {
  const paidAt = facts.datePaidGmt !== null && Number.isFinite(Date.parse(facts.datePaidGmt))
    ? facts.datePaidGmt
    : null;
  const result = (eligible: boolean, reason: WooCommerceEligibilityReason) =>
    Object.freeze({
      eligible,
      reason,
      orderId: facts.orderId,
      status: facts.status,
      paidAt,
    });

  if (facts.status === null || !WOOCOMMERCE_ELIGIBLE_ORDER_STATUSES.includes(facts.status)) {
    return result(false, "ORDER_STATUS_INELIGIBLE");
  }
  if (paidAt === null) return result(false, "ORDER_NOT_PAID");
  if (facts.totalMinor === null || facts.totalMinor <= 0n) return result(false, "ORDER_TOTAL_INVALID");
  if (facts.refundedMinor === null || facts.refundedMinor !== 0n) return result(false, "ORDER_HAS_REFUNDS");
  return result(true, "ELIGIBLE_PAID_ORDER");
}
