import { normalizeCommerceOrder } from "../commerce";

describe("Share-to-Grow commerce normalization", () => {
  test("normalizes a line and calculates DMP from approved direct costs", () => {
    const [line] = normalizeCommerceOrder({
      channel: "stonerusa",
      externalOrderId: "78142",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-05T12:00:00Z",
      lines: [{
        externalLineId: "1",
        productId: "stoner-gym-performance-tee",
        quantity: 1,
        grossMerchandiseMinor: BigInt(6000),
        discountMinor: BigInt(0),
        refundMinor: BigInt(0),
        costs: [
          { kind: "cogs", amountMinor: BigInt(1800) },
          { kind: "inbound_freight_duty", amountMinor: BigInt(100) },
          { kind: "fulfillment_packaging", amountMinor: BigInt(200) },
          { kind: "payment_processing", amountMinor: BigInt(200) },
        ],
      }],
    });

    expect(line.distributableMerchandiseProfit.minor).toBe(BigInt(3700));
    expect(line.lineKey).toBe("stonerusa:78142:1");
  });

  test("aggregates repeated cost components deterministically", () => {
    const [line] = normalizeCommerceOrder({
      channel: "event-pos",
      externalOrderId: "A1",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-05T12:00:00Z",
      lines: [{
        externalLineId: "L1",
        productId: "tee",
        quantity: 1,
        grossMerchandiseMinor: BigInt(5000),
        discountMinor: BigInt(500),
        refundMinor: BigInt(0),
        costs: [
          { kind: "cogs", amountMinor: BigInt(1000) },
          { kind: "cogs", amountMinor: BigInt(250) },
        ],
      }],
    });

    expect(line.costs.cogs.minor).toBe(BigInt(1250));
    expect(line.distributableMerchandiseProfit.minor).toBe(BigInt(3250));
  });

  test("keeps line items separate for different product economics", () => {
    const lines = normalizeCommerceOrder({
      channel: "stonerusa",
      externalOrderId: "mixed-cart",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-05T12:00:00Z",
      lines: [
        {
          externalLineId: "gym",
          productId: "stoner-gym-tee",
          quantity: 1,
          grossMerchandiseMinor: BigInt(6000),
          discountMinor: BigInt(0),
          refundMinor: BigInt(0),
          costs: [],
        },
        {
          externalLineId: "core",
          productId: "stoner-core-hat",
          quantity: 1,
          grossMerchandiseMinor: BigInt(3000),
          discountMinor: BigInt(0),
          refundMinor: BigInt(0),
          costs: [],
        },
      ],
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].lineKey).not.toBe(lines[1].lineKey);
  });

  test("rejects duplicate external line IDs inside one order", () => {
    expect(() => normalizeCommerceOrder({
      channel: "stonerusa",
      externalOrderId: "dup",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-05T12:00:00Z",
      lines: [
        { externalLineId: "1", productId: "a", quantity: 1, grossMerchandiseMinor: BigInt(100), discountMinor: BigInt(0), refundMinor: BigInt(0), costs: [] },
        { externalLineId: "1", productId: "b", quantity: 1, grossMerchandiseMinor: BigInt(100), discountMinor: BigInt(0), refundMinor: BigInt(0), costs: [] },
      ],
    })).toThrow("DUPLICATE_EXTERNAL_LINE_ID");
  });

  test("rejects negative source components rather than hiding bad commerce data", () => {
    expect(() => normalizeCommerceOrder({
      channel: "stonerusa",
      externalOrderId: "bad",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-05T12:00:00Z",
      lines: [{
        externalLineId: "1",
        productId: "tee",
        quantity: 1,
        grossMerchandiseMinor: BigInt(6000),
        discountMinor: BigInt(-1),
        refundMinor: BigInt(0),
        costs: [],
      }],
    })).toThrow("NEGATIVE_COMMERCE_COMPONENT");
  });
});
