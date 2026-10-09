import {
  GENESIS_WOOCOMMERCE_ORDER_META,
  type WooCommerceLineSnapshot,
  type WooCommerceOrderSnapshot,
} from "./woocommerce";

import type { WooCommerceOrderEligibilityFacts } from "./woocommerce-eligibility";

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

export function wooDecimalToMinor(value: unknown, currencyMinorDigits = 2): bigint {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("INVALID_WOOCOMMERCE_MONEY");
  }
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error("INVALID_WOOCOMMERCE_MONEY");
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > currencyMinorDigits) throw new Error("WOOCOMMERCE_MONEY_PRECISION_EXCEEDED");
  const padded = fraction.padEnd(currencyMinorDigits, "0");
  const minor = BigInt(whole) * (10n ** BigInt(currencyMinorDigits)) + BigInt(padded || "0");
  return negative ? -minor : minor;
}

function metaRecord(payload: JsonObject): Readonly<Record<string, string | undefined>> {
  const records = Array.isArray(payload.meta_data) ? payload.meta_data : [];
  const meta: Record<string, string | undefined> = {};
  for (const raw of records) {
    const item = object(raw, "INVALID_WOOCOMMERCE_META");
    if (typeof item.key === "string" && typeof item.value === "string") meta[item.key] = item.value;
  }
  return Object.freeze(meta);
}

function lineMeta(line: JsonObject): Readonly<Record<string, string | undefined>> {
  return metaRecord(line);
}

function requiredCost(meta: Readonly<Record<string, string | undefined>>, key: string): bigint {
  const value = meta[key];
  if (value === undefined) throw new Error(`MISSING_WOOCOMMERCE_COST:${key}`);
  return wooDecimalToMinor(value);
}

export const GENESIS_WOOCOMMERCE_LINE_META = Object.freeze({
  cogs: "_genesis_cogs",
  inboundFreightDuty: "_genesis_inbound_freight_duty",
  fulfillmentPackaging: "_genesis_fulfillment_packaging",
  paymentProcessing: "_genesis_payment_processing",
});

export interface ParsedWooCommerceOrderPayload {
  readonly order: WooCommerceOrderSnapshot;
  readonly orderMeta: Readonly<Record<string, string | undefined>>;
}

export function parseWooCommerceOrderPayload(input: {
  rawBody: string;
  organizationId: string;
}): ParsedWooCommerceOrderPayload {
  let raw: unknown;
  try { raw = JSON.parse(input.rawBody); } catch { throw new Error("INVALID_WOOCOMMERCE_JSON"); }
  const payload = object(raw, "INVALID_WOOCOMMERCE_ORDER_PAYLOAD");
  const currency = stringValue(payload.currency, "MISSING_WOOCOMMERCE_CURRENCY").toUpperCase();
  const convertedAt = stringValue(
    payload.date_paid_gmt ?? payload.date_created_gmt ?? payload.date_modified_gmt,
    "MISSING_WOOCOMMERCE_CONVERSION_TIME",
  );
  if (!Number.isFinite(Date.parse(convertedAt))) throw new Error("INVALID_WOOCOMMERCE_CONVERSION_TIME");
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    throw new Error("MISSING_WOOCOMMERCE_LINE_ITEMS");
  }

  const lines: WooCommerceLineSnapshot[] = payload.line_items.map((rawLine) => {
    const line = object(rawLine, "INVALID_WOOCOMMERCE_LINE_ITEM");
    const meta = lineMeta(line);
    const quantity = integerValue(line.quantity, "INVALID_WOOCOMMERCE_QUANTITY");
    const gross = wooDecimalToMinor(line.subtotal);
    const net = wooDecimalToMinor(line.total);
    if (net > gross) throw new Error("INVALID_WOOCOMMERCE_LINE_DISCOUNT");
    return Object.freeze({
      lineItemId: idValue(line.id, "MISSING_WOOCOMMERCE_LINE_ID"),
      productId: idValue(line.variation_id || line.product_id, "MISSING_WOOCOMMERCE_PRODUCT_ID"),
      quantity,
      grossMerchandiseMinor: gross,
      discountMinor: gross - net,
      refundMinor: 0n,
      cogsMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.cogs),
      inboundFreightDutyMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.inboundFreightDuty),
      fulfillmentPackagingMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.fulfillmentPackaging),
      paymentProcessingMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.paymentProcessing),
    });
  });

  const orderMeta = metaRecord(payload);
  return Object.freeze({
    order: Object.freeze({
      orderId: idValue(payload.id, "MISSING_WOOCOMMERCE_ORDER_ID"),
      organizationId: input.organizationId,
      currency,
      convertedAt,
      lines: Object.freeze(lines),
    }),
    orderMeta,
  });
}

export interface ParsedWooCommerceRefundPayload {
  readonly refundId: string;
  readonly orderId: string;
  readonly createdAt: string;
  readonly lineRefunds: readonly { lineItemId: string; refundGrossMinor: bigint }[];
}

export function parseWooCommerceRefundPayload(rawBody: string): ParsedWooCommerceRefundPayload {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_WOOCOMMERCE_JSON"); }
  const payload = object(raw, "INVALID_WOOCOMMERCE_REFUND_PAYLOAD");
  const createdAt = stringValue(payload.date_created_gmt, "MISSING_WOOCOMMERCE_REFUND_TIME");
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("INVALID_WOOCOMMERCE_REFUND_TIME");
  const lines = Array.isArray(payload.line_items) ? payload.line_items : [];
  return Object.freeze({
    refundId: idValue(payload.id, "MISSING_WOOCOMMERCE_REFUND_ID"),
    orderId: idValue(payload.parent_id, "MISSING_WOOCOMMERCE_REFUND_ORDER_ID"),
    createdAt,
    lineRefunds: Object.freeze(lines.map((rawLine) => {
      const line = object(rawLine, "INVALID_WOOCOMMERCE_REFUND_LINE");
      // Woo refund line items carry their own id; the original order line is
      // referenced by the `_refunded_item_id` meta when present.
      const refundedItemId = lineMeta(line)._refunded_item_id;
      return Object.freeze({
        lineItemId: refundedItemId && refundedItemId.length > 0
          ? refundedItemId
          : idValue(line.id, "MISSING_WOOCOMMERCE_REFUND_LINE_ID"),
        refundGrossMinor: -wooDecimalToMinor(line.total),
      });
    })),
  });
}

export function parseWooCommerceOrderEligibilityFacts(rawBody: string): WooCommerceOrderEligibilityFacts {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_WOOCOMMERCE_JSON"); }
  const payload = object(raw, "INVALID_WOOCOMMERCE_ORDER_PAYLOAD");
  const money = (value: unknown): bigint | null => {
    try { return wooDecimalToMinor(value); } catch { return null; }
  };

  let refundedMinor: bigint | null = 0n;
  if (payload.refunds !== undefined && payload.refunds !== null) {
    if (!Array.isArray(payload.refunds)) {
      refundedMinor = null;
    } else {
      for (const refund of payload.refunds) {
        const amount = refund && typeof refund === "object" ? money((refund as JsonObject).total) : null;
        if (amount === null || refundedMinor === null) { refundedMinor = null; break; }
        refundedMinor += amount;
      }
    }
  }

  return Object.freeze({
    orderId: idValue(payload.id, "MISSING_WOOCOMMERCE_ORDER_ID"),
    status: typeof payload.status === "string" ? payload.status : null,
    datePaidGmt: typeof payload.date_paid_gmt === "string" ? payload.date_paid_gmt : null,
    totalMinor: money(payload.total),
    refundedMinor,
  });
}

export interface ParsedWooCommerceCancellationPayload {
  readonly orderId: string;
}

export function parseWooCommerceCancellationPayload(rawBody: string): ParsedWooCommerceCancellationPayload {
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { throw new Error("INVALID_WOOCOMMERCE_JSON"); }
  const payload = object(raw, "INVALID_WOOCOMMERCE_ORDER_PAYLOAD");
  if (payload.status !== "cancelled") throw new Error("INVALID_WOOCOMMERCE_CANCELLATION_STATUS");
  return Object.freeze({ orderId: idValue(payload.id, "MISSING_WOOCOMMERCE_ORDER_ID") });
}

export function extractGenesisOrderMeta(payload: ParsedWooCommerceOrderPayload) {
  return Object.freeze({
    touchId: payload.orderMeta[GENESIS_WOOCOMMERCE_ORDER_META.touchId],
    trackingIdentityId: payload.orderMeta[GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId],
    canonicalPartnerId: payload.orderMeta[GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId],
    campaignId: payload.orderMeta[GENESIS_WOOCOMMERCE_ORDER_META.campaignId],
  });
}
