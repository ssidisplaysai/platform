import {
  GENESIS_SHOPIFY_ATTRIBUTE_KEYS,
  genesisAttributionFromShopifyAttributes,
  type ShopifyLineSnapshot,
  type ShopifyOrderSnapshot,
} from "./shopify";
import { wooDecimalToMinor } from "./woocommerce-payloads";
import type { ShopifyOrderEligibilityFacts } from "./shopify-eligibility";

type JsonObject = Readonly<Record<string, unknown>>;

function object(value: unknown, error: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(error);
  return value as JsonObject;
}

function stringValue(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value;
}

function idValue(value: unknown, error: string): string {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).length === 0) {
    throw new Error(error);
  }
  return String(value);
}

function integerValue(value: unknown, error: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(error);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function listNameValue(
  value: unknown,
  error: string,
): Readonly<Record<string, string | undefined>> {
  if (!Array.isArray(value)) return Object.freeze({});
  const out: Record<string, string | undefined> = {};
  for (const item of value) {
    const row = object(item, error);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    if (typeof row.value === "string") out[name] = row.value;
  }
  return Object.freeze(out);
}

function requiredCost(meta: Readonly<Record<string, string | undefined>>, key: string): bigint {
  const value = meta[key];
  if (value === undefined) throw new Error(`MISSING_SHOPIFY_COST:${key}`);
  return wooDecimalToMinor(value);
}

export const GENESIS_SHOPIFY_LINE_PROPERTY_KEYS = Object.freeze({
  cogs: "genesis_cogs",
  inboundFreightDuty: "genesis_inbound_freight_duty",
  fulfillmentPackaging: "genesis_fulfillment_packaging",
  paymentProcessing: "genesis_payment_processing",
});

function lineAttribution(properties: Readonly<Record<string, string | undefined>>) {
  return genesisAttributionFromShopifyAttributes(properties);
}

export interface ParsedShopifyOrderPayload {
  readonly order: ShopifyOrderSnapshot;
  readonly orderAttributes: Readonly<Record<string, string | undefined>>;
}

export function parseShopifyOrderPayload(input: {
  rawBody: string;
  organizationId: string;
}): ParsedShopifyOrderPayload {
  let raw: unknown;
  try { raw = JSON.parse(input.rawBody); } catch { throw new Error("INVALID_SHOPIFY_JSON"); }
  const payload = object(raw, "INVALID_SHOPIFY_ORDER_PAYLOAD");
  const currency = stringValue(payload.currency, "MISSING_SHOPIFY_CURRENCY").toUpperCase();
  const convertedAt = stringValue(
    payload.processed_at ?? payload.created_at ?? payload.updated_at,
    "MISSING_SHOPIFY_CONVERSION_TIME",
  );
  if (!Number.isFinite(Date.parse(convertedAt))) throw new Error("INVALID_SHOPIFY_CONVERSION_TIME");
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    throw new Error("MISSING_SHOPIFY_LINE_ITEMS");
  }

  const orderAttributes = listNameValue(payload.note_attributes, "INVALID_SHOPIFY_NOTE_ATTRIBUTES");
  const orderLevelAttribution = genesisAttributionFromShopifyAttributes(orderAttributes);

  const lines: ShopifyLineSnapshot[] = payload.line_items.map((rawLine) => {
    const line = object(rawLine, "INVALID_SHOPIFY_LINE_ITEM");
    const quantity = integerValue(line.quantity, "INVALID_SHOPIFY_QUANTITY");
    const properties = listNameValue(line.properties, "INVALID_SHOPIFY_LINE_PROPERTIES");
    const grossUnitMinor = wooDecimalToMinor(line.price);
    const gross = grossUnitMinor * BigInt(quantity);
    const discount = wooDecimalToMinor(line.total_discount ?? "0");
    if (discount > gross) throw new Error("INVALID_SHOPIFY_LINE_DISCOUNT");
    const directAttribution = lineAttribution(properties);

    const enrichedProperties = {
      ...properties,
      ...(orderLevelAttribution ? {
        [GENESIS_SHOPIFY_ATTRIBUTE_KEYS.touchId]: properties[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.touchId]
          ?? orderLevelAttribution.touchId,
        [GENESIS_SHOPIFY_ATTRIBUTE_KEYS.trackingIdentityId]:
          properties[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.trackingIdentityId]
          ?? orderLevelAttribution.trackingIdentityId,
        [GENESIS_SHOPIFY_ATTRIBUTE_KEYS.canonicalPartnerId]:
          properties[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.canonicalPartnerId]
          ?? orderLevelAttribution.canonicalPartnerId,
        [GENESIS_SHOPIFY_ATTRIBUTE_KEYS.campaignId]:
          properties[GENESIS_SHOPIFY_ATTRIBUTE_KEYS.campaignId]
          ?? orderLevelAttribution.campaignId,
      } : {}),
    };

    return Object.freeze({
      lineItemId: idValue(line.id, "MISSING_SHOPIFY_LINE_ID"),
      productId: idValue(line.variant_id ?? line.product_id, "MISSING_SHOPIFY_PRODUCT_ID"),
      quantity,
      grossMerchandiseMinor: gross,
      discountMinor: discount,
      refundMinor: 0n,
      cogsMinor: requiredCost(enrichedProperties, GENESIS_SHOPIFY_LINE_PROPERTY_KEYS.cogs),
      inboundFreightDutyMinor: requiredCost(
        enrichedProperties,
        GENESIS_SHOPIFY_LINE_PROPERTY_KEYS.inboundFreightDuty,
      ),
      fulfillmentPackagingMinor: requiredCost(
        enrichedProperties,
        GENESIS_SHOPIFY_LINE_PROPERTY_KEYS.fulfillmentPackaging,
      ),
      paymentProcessingMinor: requiredCost(
        enrichedProperties,
        GENESIS_SHOPIFY_LINE_PROPERTY_KEYS.paymentProcessing,
      ),
      attribution: directAttribution ?? orderLevelAttribution,
    });
  });

  return Object.freeze({
    order: Object.freeze({
      orderId: idValue(payload.id, "MISSING_SHOPIFY_ORDER_ID"),
      organizationId: input.organizationId,
      currency,
      convertedAt,
      lines: Object.freeze(lines),
      attribution: orderLevelAttribution
        ?? lines.find((line) => line.attribution !== undefined)?.attribution,
    }),
    orderAttributes,
  });
}

export interface ParsedShopifyRefundPayload {
  readonly refundId: string;
  readonly orderId: string;
  readonly createdAt: string;
  readonly lineRefunds: readonly { lineItemId: string; refundGrossMinor: bigint }[];
}

export function parseShopifyRefundPayload(rawBody: string): ParsedShopifyRefundPayload {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_SHOPIFY_JSON"); }
  const payload = object(raw, "INVALID_SHOPIFY_REFUND_PAYLOAD");
  const createdAt = stringValue(payload.created_at, "MISSING_SHOPIFY_REFUND_TIME");
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("INVALID_SHOPIFY_REFUND_TIME");
  const refundLineItems = Array.isArray(payload.refund_line_items) ? payload.refund_line_items : [];
  return Object.freeze({
    refundId: idValue(payload.id, "MISSING_SHOPIFY_REFUND_ID"),
    orderId: idValue(payload.order_id, "MISSING_SHOPIFY_REFUND_ORDER_ID"),
    createdAt,
    lineRefunds: Object.freeze(refundLineItems.map((rawLine) => {
      const line = object(rawLine, "INVALID_SHOPIFY_REFUND_LINE");
      const lineItem = object(line.line_item, "MISSING_SHOPIFY_REFUND_LINE_ITEM");
      const refundValue = line.subtotal ?? line.total ?? line.line_item_total;
      const refundGrossMinor = wooDecimalToMinor(refundValue);
      if (refundGrossMinor < 0n) throw new Error("REFUND_LINE_AMOUNT_INVALID");
      return Object.freeze({
        lineItemId: idValue(lineItem.id, "MISSING_SHOPIFY_REFUND_LINE_ID"),
        refundGrossMinor,
      });
    })),
  });
}

export interface ParsedShopifyCancellationPayload {
  readonly orderId: string;
}

export function parseShopifyCancellationPayload(rawBody: string): ParsedShopifyCancellationPayload {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_SHOPIFY_JSON"); }
  const payload = object(raw, "INVALID_SHOPIFY_ORDER_PAYLOAD");
  const cancelledAt = optionalString(payload.cancelled_at);
  if (!cancelledAt || !Number.isFinite(Date.parse(cancelledAt))) {
    throw new Error("INVALID_SHOPIFY_CANCELLATION_STATUS");
  }
  return Object.freeze({ orderId: idValue(payload.id, "MISSING_SHOPIFY_ORDER_ID") });
}

export function parseShopifyOrderEligibilityFacts(rawBody: string): ShopifyOrderEligibilityFacts {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_SHOPIFY_JSON"); }
  const payload = object(raw, "INVALID_SHOPIFY_ORDER_PAYLOAD");

  return Object.freeze({
    orderId: idValue(payload.id, "MISSING_SHOPIFY_ORDER_ID"),
    financialStatus: optionalString(payload.financial_status) ?? null,
    cancelledAt: optionalString(payload.cancelled_at) ?? null,
    paidAt: optionalString(payload.processed_at)
      ?? optionalString(payload.closed_at)
      ?? optionalString(payload.created_at)
      ?? null,
    totalMinor: (() => {
      const value = payload.current_total_price ?? payload.total_price;
      if (value === undefined || value === null) return null;
      try {
        return wooDecimalToMinor(value);
      } catch {
        return null;
      }
    })(),
  });
}
