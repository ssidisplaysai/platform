import type { CommerceOrderInput, CommerceOrderLineInput } from "../commerce";

export const WOOCOMMERCE_CHANNEL = "woocommerce";

export interface WooCommerceGenesisAttribution {
  readonly touchId?: string;
  readonly trackingIdentityId?: string;
  readonly canonicalPartnerId?: string;
  readonly campaignId?: string;
}

export interface WooCommerceMoneyTotal {
  readonly grossMerchandiseMinor: bigint;
  readonly discountMinor: bigint;
  readonly refundMinor: bigint;
  readonly cogsMinor: bigint;
  readonly inboundFreightDutyMinor: bigint;
  readonly fulfillmentPackagingMinor: bigint;
  readonly paymentProcessingMinor: bigint;
}

export interface WooCommerceLineSnapshot extends WooCommerceMoneyTotal {
  readonly lineItemId: string;
  readonly productId: string;
  readonly quantity: number;
}

export interface WooCommerceOrderSnapshot {
  readonly orderId: string;
  readonly organizationId: string;
  readonly currency: string;
  readonly convertedAt: string;
  readonly lines: readonly WooCommerceLineSnapshot[];
  readonly attribution?: WooCommerceGenesisAttribution;
}

/**
 * Provider boundary: WordPress/WooCommerce parsing stays outside the Genesis
 * economic engine. All provider money must already be converted to integer
 * minor units before it reaches this function.
 */
export function normalizeWooCommerceOrder(
  order: WooCommerceOrderSnapshot,
): CommerceOrderInput {
  const lines: CommerceOrderLineInput[] = order.lines.map((line) => ({
    externalLineId: line.lineItemId,
    productId: line.productId,
    quantity: line.quantity,
    grossMerchandiseMinor: line.grossMerchandiseMinor,
    discountMinor: line.discountMinor,
    refundMinor: line.refundMinor,
    costs: [
      { kind: "cogs", amountMinor: line.cogsMinor },
      { kind: "inbound_freight_duty", amountMinor: line.inboundFreightDutyMinor },
      { kind: "fulfillment_packaging", amountMinor: line.fulfillmentPackagingMinor },
      { kind: "payment_processing", amountMinor: line.paymentProcessingMinor },
    ],
  }));

  return Object.freeze({
    channel: WOOCOMMERCE_CHANNEL,
    externalOrderId: order.orderId,
    organizationId: order.organizationId,
    currency: order.currency,
    convertedAt: order.convertedAt,
    lines: Object.freeze(lines),
  });
}

export const GENESIS_WOOCOMMERCE_ORDER_META = Object.freeze({
  touchId: "_genesis_touch_id",
  trackingIdentityId: "_genesis_tracking_identity_id",
  canonicalPartnerId: "_genesis_partner_id",
  campaignId: "_genesis_campaign_id",
});

/**
 * These keys are correlation evidence only. WordPress/WooCommerce must never
 * supply economic percentages, DMP, beneficiary allocations or payout values.
 */
export function genesisAttributionFromWooMeta(
  meta: Readonly<Record<string, string | undefined>>,
): WooCommerceGenesisAttribution | undefined {
  const value = Object.freeze({
    touchId: meta[GENESIS_WOOCOMMERCE_ORDER_META.touchId],
    trackingIdentityId: meta[GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId],
    canonicalPartnerId: meta[GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId],
    campaignId: meta[GENESIS_WOOCOMMERCE_ORDER_META.campaignId],
  });
  return Object.values(value).some(Boolean) ? value : undefined;
}
