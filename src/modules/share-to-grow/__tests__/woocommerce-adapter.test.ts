import { normalizeCommerceOrder } from "../commerce";
import {
  GENESIS_WOOCOMMERCE_ORDER_META,
  genesisAttributionFromWooMeta,
  normalizeWooCommerceOrder,
} from "../adapters/woocommerce";

describe("WooCommerce Share-to-Grow adapter contract", () => {
  test("normalizes a canonical STONER WooCommerce order line", () => {
    const input = normalizeWooCommerceOrder({
      orderId: "78142",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-06T12:00:00Z",
      lines: [{
        lineItemId: "9001",
        productId: "stoner-gym-performance-tee",
        quantity: 1,
        grossMerchandiseMinor: BigInt(6000),
        discountMinor: BigInt(0),
        refundMinor: BigInt(0),
        cogsMinor: BigInt(1800),
        inboundFreightDutyMinor: BigInt(200),
        fulfillmentPackagingMinor: BigInt(100),
        paymentProcessingMinor: BigInt(200),
      }],
    });

    const [line] = normalizeCommerceOrder(input);
    expect(line.organizationId).toBe("stoner");
    expect(line.lineKey).toBe("woocommerce:78142:9001");
    expect(line.distributableMerchandiseProfit.minor).toBe(BigInt(3700));
  });

  test("extracts Genesis attribution evidence from protected Woo order metadata", () => {
    expect(genesisAttributionFromWooMeta({
      [GENESIS_WOOCOMMERCE_ORDER_META.touchId]: "touch-1",
      [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: "tracking-1",
      [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "partner-daniel",
      [GENESIS_WOOCOMMERCE_ORDER_META.campaignId]: "gym-launch",
    })).toEqual({
      touchId: "touch-1",
      trackingIdentityId: "tracking-1",
      canonicalPartnerId: "partner-daniel",
      campaignId: "gym-launch",
    });
  });

  test("rejects invalid currency, timestamp and negative DMP", () => {
    const base = {
      channel: "woocommerce",
      externalOrderId: "1",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-06T12:00:00Z",
      lines: [{
        externalLineId: "1",
        productId: "sku",
        quantity: 1,
        grossMerchandiseMinor: BigInt(100),
        discountMinor: BigInt(0),
        refundMinor: BigInt(0),
        costs: [{ kind: "cogs" as const, amountMinor: BigInt(101) }],
      }],
    };
    expect(() => normalizeCommerceOrder({ ...base, currency: "usd" })).toThrow("INVALID_COMMERCE_CURRENCY");
    expect(() => normalizeCommerceOrder({ ...base, convertedAt: "bad" })).toThrow("INVALID_COMMERCE_TIMESTAMP");
    expect(() => normalizeCommerceOrder(base)).toThrow("NEGATIVE_DISTRIBUTABLE_MERCHANDISE_PROFIT");
  });
});
