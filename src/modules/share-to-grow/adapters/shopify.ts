import type { CommerceOrderInput, CommerceOrderLineInput } from "../commerce";

export const SHOPIFY_CHANNEL = "shopify";

export const GENESIS_SHOPIFY_ATTRIBUTE_KEYS = Object.freeze({
  touchId: "genesis_touch_id",
  trackingIdentityId: "genesis_tracking_identity_id",
  canonicalPartnerId: "genesis_partner_id",
  campaignId: "genesis_campaign_id",
});

export interface ShopifyGenesisAttribution {
  readonly touchId?: string;
  readonly trackingIdentityId?: string;
  readonly canonicalPartnerId?: string;
  readonly campaignId?: string;
}

export interface ShopifyMoneyTotal {
  readonly grossMerchandiseMinor: bigint;
  readonly customerShippingRevenueMinor?: bigint;
  readonly discountMinor: bigint;
  readonly refundMinor: bigint;
  readonly cogsMinor: bigint;
  readonly inboundFreightDutyMinor: bigint;
  readonly outboundShippingLabelMinor?: bigint;
  readonly fulfillmentPackagingMinor: bigint;
  readonly paymentProcessingMinor: bigint;
}

export interface ShopifyLineSnapshot extends ShopifyMoneyTotal {
  readonly lineItemId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly attribution?: ShopifyGenesisAttribution;
}

export interface ShopifyOrderSnapshot {
  readonly orderId: string;
  readonly organizationId: string;
  readonly currency: string;
  readonly convertedAt: string;
  readonly lines: readonly ShopifyLineSnapshot[];
  readonly attribution?: ShopifyGenesisAttribution;
}

export function normalizeShopifyOrder(order: ShopifyOrderSnapshot): CommerceOrderInput {
  const lines: CommerceOrderLineInput[] = order.lines.map((line) => ({
    externalLineId: line.lineItemId,
    productId: line.productId,
    quantity: line.quantity,
    grossMerchandiseMinor: line.grossMerchandiseMinor,
    customerShippingRevenueMinor: line.customerShippingRevenueMinor ?? 0n,
    discountMinor: line.discountMinor,
    refundMinor: line.refundMinor,
    costs: [
      { kind: "cogs", amountMinor: line.cogsMinor },
      { kind: "inbound_freight_duty", amountMinor: line.inboundFreightDutyMinor },
      { kind: "outbound_shipping_label", amountMinor: line.outboundShippingLabelMinor ?? 0n },
      { kind: "fulfillment_packaging", amountMinor: line.fulfillmentPackagingMinor },
      { kind: "payment_processing", amountMinor: line.paymentProcessingMinor },
    ],
  }));

  return Object.freeze({
    channel: SHOPIFY_CHANNEL,
    externalOrderId: order.orderId,
    organizationId: order.organizationId,
    currency: order.currency,
    convertedAt: order.convertedAt,
    lines: Object.freeze(lines),
  });
}

export function genesisAttributionFromShopifyAttributes(
  attributes: Readonly<Record<string, string | undefined>>,
): ShopifyGenesisAttribution | undefined {
  const value = Object.freeze({
    touchId: attributes[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.touchId],
    trackingIdentityId: attributes[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.trackingIdentityId],
    canonicalPartnerId: attributes[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.canonicalPartnerId],
    campaignId: attributes[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.campaignId],
  });
  return Object.values(value).some(Boolean) ? value : undefined;
}
