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

function optionalCost(meta: Readonly<Record<string, string | undefined>>, key: string): bigint {
  const value = meta[key];
  if (value === undefined) return 0n;
  return wooDecimalToMinor(value);
}

function hasMeta(meta: Readonly<Record<string, string | undefined>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(meta, key);
}

export const GENESIS_WOOCOMMERCE_LINE_META = Object.freeze({
  cogs: "_genesis_cogs",
  inboundFreightDuty: "_genesis_inbound_freight_duty",
  fulfillmentPackaging: "_genesis_fulfillment_packaging",
  paymentProcessing: "_genesis_payment_processing",
});

export const GENESIS_WOOCOMMERCE_ORDER_COST_META = Object.freeze({
  customerShippingRevenue: "_genesis_customer_shipping_revenue",
  outboundShippingLabelActual: "_genesis_outbound_shipping_label_actual",
  outboundShippingLabelEstimate: "_genesis_outbound_shipping_label_estimate",
  orderFulfillmentPackagingActual: "_genesis_order_fulfillment_packaging_actual",
  paymentProcessingActual: "_genesis_payment_processing_fee_actual",
});

function allocateOrderMinorAcrossLines(input: {
  totalMinor: bigint;
  weights: readonly bigint[];
  errorCode: string;
}): readonly bigint[] {
  if (input.totalMinor === 0n) return Object.freeze(input.weights.map(() => 0n));
  const totalWeight = input.weights.reduce((sum, weight) => sum + weight, 0n);
  if (totalWeight <= 0n) throw new Error(input.errorCode);

  const sign = input.totalMinor < 0n ? -1n : 1n;
  const absoluteTotal = input.totalMinor < 0n ? -input.totalMinor : input.totalMinor;
  const allocations = input.weights.map((weight, index) => {
    const weighted = absoluteTotal * weight;
    const base = weighted / totalWeight;
    const remainder = weighted % totalWeight;
    return { index, base, remainder };
  });

  const allocated = allocations.reduce((sum, line) => sum + line.base, 0n);
  let remainderMinor = absoluteTotal - allocated;
  allocations.sort((left, right) => Number(right.remainder - left.remainder) || left.index - right.index);
  for (const line of allocations) {
    if (remainderMinor <= 0n) break;
    line.base += 1n;
    remainderMinor -= 1n;
  }

  const out = new Array<bigint>(input.weights.length).fill(0n);
  for (const line of allocations) out[line.index] = line.base * sign;
  return Object.freeze(out);
}

export interface ParsedWooCommerceOrderPayload {
  readonly order: WooCommerceOrderSnapshot;
  readonly orderMeta: Readonly<Record<string, string | undefined>>;
}

export function parseWooCommerceOrderPayload(input: {
  rawBody: string;
  organizationId: string;
  allowEstimatedOutboundShippingLabel?: boolean;
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

  const orderMeta = metaRecord(payload);
  const hasOrderFulfillmentPackaging = hasMeta(
    orderMeta,
    GENESIS_WOOCOMMERCE_ORDER_COST_META.orderFulfillmentPackagingActual,
  );
  const hasOrderPaymentProcessing = hasMeta(
    orderMeta,
    GENESIS_WOOCOMMERCE_ORDER_COST_META.paymentProcessingActual,
  );
  const customerShippingRevenueMinor = optionalCost(orderMeta, GENESIS_WOOCOMMERCE_ORDER_COST_META.customerShippingRevenue);
  const outboundShippingLabelActualMinor = optionalCost(orderMeta, GENESIS_WOOCOMMERCE_ORDER_COST_META.outboundShippingLabelActual);
  const outboundShippingLabelEstimateMinor = optionalCost(orderMeta, GENESIS_WOOCOMMERCE_ORDER_COST_META.outboundShippingLabelEstimate);
  const outboundShippingLabelMinor = outboundShippingLabelActualMinor !== 0n
    ? outboundShippingLabelActualMinor
    : input.allowEstimatedOutboundShippingLabel
      ? outboundShippingLabelEstimateMinor
      : 0n;
  const orderFulfillmentPackagingMinor = optionalCost(orderMeta, GENESIS_WOOCOMMERCE_ORDER_COST_META.orderFulfillmentPackagingActual);
  const orderPaymentProcessingMinor = optionalCost(orderMeta, GENESIS_WOOCOMMERCE_ORDER_COST_META.paymentProcessingActual);

  const linesPre = payload.line_items.map((rawLine) => {
    const line = object(rawLine, "INVALID_WOOCOMMERCE_LINE_ITEM");
    const meta = lineMeta(line);
    const quantity = integerValue(line.quantity, "INVALID_WOOCOMMERCE_QUANTITY");
    const gross = wooDecimalToMinor(line.subtotal);
    const net = wooDecimalToMinor(line.total);
    if (net > gross) throw new Error("INVALID_WOOCOMMERCE_LINE_DISCOUNT");
    const hasLineFulfillmentPackaging = hasMeta(meta, GENESIS_WOOCOMMERCE_LINE_META.fulfillmentPackaging);
    const hasLinePaymentProcessing = hasMeta(meta, GENESIS_WOOCOMMERCE_LINE_META.paymentProcessing);
    return Object.freeze({
      lineItemId: idValue(line.id, "MISSING_WOOCOMMERCE_LINE_ID"),
      productId: idValue(line.variation_id || line.product_id, "MISSING_WOOCOMMERCE_PRODUCT_ID"),
      quantity,
      grossMerchandiseMinor: gross,
      discountMinor: gross - net,
      refundMinor: 0n,
      // Bridge cost metadata is per unit; normalize to line totals.
      cogsMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.cogs) * BigInt(quantity),
      inboundFreightDutyMinor: requiredCost(meta, GENESIS_WOOCOMMERCE_LINE_META.inboundFreightDuty) * BigInt(quantity),
      fulfillmentPackagingMinor: optionalCost(meta, GENESIS_WOOCOMMERCE_LINE_META.fulfillmentPackaging) * BigInt(quantity),
      paymentProcessingMinor: optionalCost(meta, GENESIS_WOOCOMMERCE_LINE_META.paymentProcessing) * BigInt(quantity),
      hasLineFulfillmentPackaging,
      hasLinePaymentProcessing,
    });
  });

  if (!hasOrderFulfillmentPackaging && linesPre.some((line) => !line.hasLineFulfillmentPackaging)) {
    throw new Error(`MISSING_WOOCOMMERCE_COST_SOURCE:${GENESIS_WOOCOMMERCE_LINE_META.fulfillmentPackaging}`);
  }
  if (!hasOrderPaymentProcessing && linesPre.some((line) => !line.hasLinePaymentProcessing)) {
    throw new Error(`MISSING_WOOCOMMERCE_COST_SOURCE:${GENESIS_WOOCOMMERCE_LINE_META.paymentProcessing}`);
  }

  const lineFulfillmentMinor = linesPre.reduce((sum, line) => sum + line.fulfillmentPackagingMinor, 0n);
  if (hasOrderFulfillmentPackaging && lineFulfillmentMinor !== 0n) {
    throw new Error("DOUBLE_COUNT_WOOCOMMERCE_FULFILLMENT_PACKAGING");
  }
  const linePaymentMinor = linesPre.reduce((sum, line) => sum + line.paymentProcessingMinor, 0n);
  if (hasOrderPaymentProcessing && linePaymentMinor !== 0n) {
    throw new Error("DOUBLE_COUNT_WOOCOMMERCE_PAYMENT_PROCESSING");
  }

  const allocationWeights = linesPre.map((line) => line.grossMerchandiseMinor - line.discountMinor);
  const customerShippingByLine = allocateOrderMinorAcrossLines({
    totalMinor: customerShippingRevenueMinor,
    weights: allocationWeights,
    errorCode: "INVALID_WOOCOMMERCE_SHIPPING_REVENUE_ALLOCATION_BASIS",
  });
  const outboundShippingByLine = allocateOrderMinorAcrossLines({
    totalMinor: outboundShippingLabelMinor,
    weights: allocationWeights,
    errorCode: "INVALID_WOOCOMMERCE_SHIPPING_LABEL_ALLOCATION_BASIS",
  });
  const orderFulfillmentByLine = allocateOrderMinorAcrossLines({
    totalMinor: orderFulfillmentPackagingMinor,
    weights: allocationWeights,
    errorCode: "INVALID_WOOCOMMERCE_FULFILLMENT_ALLOCATION_BASIS",
  });
  const orderPaymentByLine = allocateOrderMinorAcrossLines({
    totalMinor: orderPaymentProcessingMinor,
    weights: allocationWeights,
    errorCode: "INVALID_WOOCOMMERCE_PAYMENT_ALLOCATION_BASIS",
  });

  const lines: WooCommerceLineSnapshot[] = linesPre.map((line, index) => Object.freeze({
    lineItemId: line.lineItemId,
    productId: line.productId,
    quantity: line.quantity,
    grossMerchandiseMinor: line.grossMerchandiseMinor,
    discountMinor: line.discountMinor,
    refundMinor: line.refundMinor,
    cogsMinor: line.cogsMinor,
    inboundFreightDutyMinor: line.inboundFreightDutyMinor,
    customerShippingRevenueMinor: customerShippingByLine[index],
    outboundShippingLabelMinor: outboundShippingByLine[index],
    fulfillmentPackagingMinor: line.fulfillmentPackagingMinor + orderFulfillmentByLine[index],
    paymentProcessingMinor: line.paymentProcessingMinor + orderPaymentByLine[index],
  }));

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
