import { money, type Money } from "./money";

export interface CommerceCostInput {
  readonly kind: "cogs" | "inbound_freight_duty" | "fulfillment_packaging" | "payment_processing";
  readonly amountMinor: bigint;
}

export interface CommerceOrderLineInput {
  readonly externalLineId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly grossMerchandiseMinor: bigint;
  readonly discountMinor: bigint;
  readonly refundMinor: bigint;
  readonly costs: readonly CommerceCostInput[];
}

export interface CommerceOrderInput {
  readonly channel: string;
  readonly externalOrderId: string;
  readonly organizationId: string;
  readonly currency: string;
  readonly convertedAt: string;
  readonly lines: readonly CommerceOrderLineInput[];
}

export interface NormalizedCommerceLine {
  readonly lineKey: string;
  readonly channel: string;
  readonly organizationId: string;
  readonly externalOrderId: string;
  readonly externalLineId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly currency: string;
  readonly convertedAt: string;
  readonly grossMerchandise: Money;
  readonly discount: Money;
  readonly refund: Money;
  readonly costs: Readonly<Record<CommerceCostInput["kind"], Money>>;
  readonly distributableMerchandiseProfit: Money;
}

const COST_KINDS: readonly CommerceCostInput["kind"][] = [
  "cogs",
  "inbound_freight_duty",
  "fulfillment_packaging",
  "payment_processing",
];

function requireNonNegative(value: bigint, field: string): void {
  if (value < BigInt(0)) throw new Error(`NEGATIVE_COMMERCE_COMPONENT:${field}`);
}

export function normalizeCommerceOrder(input: CommerceOrderInput): readonly NormalizedCommerceLine[] {
  if (!input.channel.trim() || !input.externalOrderId.trim() || !input.organizationId.trim()) {
    throw new Error("INVALID_COMMERCE_ORDER_IDENTITY");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("INVALID_COMMERCE_CURRENCY");
  }
  if (!Number.isFinite(Date.parse(input.convertedAt))) {
    throw new Error("INVALID_COMMERCE_TIMESTAMP");
  }

  const seenLineIds = new Set<string>();

  return input.lines.map((line) => {
    if (seenLineIds.has(line.externalLineId)) throw new Error("DUPLICATE_EXTERNAL_LINE_ID");
    seenLineIds.add(line.externalLineId);

    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("INVALID_LINE_QUANTITY");

    requireNonNegative(line.grossMerchandiseMinor, "grossMerchandise");
    requireNonNegative(line.discountMinor, "discount");
    requireNonNegative(line.refundMinor, "refund");

    const totals = new Map<CommerceCostInput["kind"], bigint>(
      COST_KINDS.map((kind) => [kind, BigInt(0)]),
    );
    for (const cost of line.costs) {
      requireNonNegative(cost.amountMinor, cost.kind);
      totals.set(cost.kind, (totals.get(cost.kind) ?? BigInt(0)) + cost.amountMinor);
    }

    const deductions =
      line.discountMinor +
      line.refundMinor +
      COST_KINDS.reduce((sum, kind) => sum + (totals.get(kind) ?? BigInt(0)), BigInt(0));
    const dmpMinor = line.grossMerchandiseMinor - deductions;
    if (dmpMinor < BigInt(0)) {
      throw new Error("NEGATIVE_DISTRIBUTABLE_MERCHANDISE_PROFIT");
    }

    return Object.freeze({
      lineKey: `${input.channel}:${input.externalOrderId}:${line.externalLineId}`,
      channel: input.channel,
      organizationId: input.organizationId,
      externalOrderId: input.externalOrderId,
      externalLineId: line.externalLineId,
      productId: line.productId,
      quantity: line.quantity,
      currency: input.currency,
      convertedAt: input.convertedAt,
      grossMerchandise: money(line.grossMerchandiseMinor, input.currency),
      discount: money(line.discountMinor, input.currency),
      refund: money(line.refundMinor, input.currency),
      costs: Object.freeze(
        Object.fromEntries(
          COST_KINDS.map((kind) => [kind, money(totals.get(kind) ?? BigInt(0), input.currency)]),
        ),
      ) as Readonly<Record<CommerceCostInput["kind"], Money>>,
      distributableMerchandiseProfit: money(dmpMinor, input.currency),
    });
  });
}
