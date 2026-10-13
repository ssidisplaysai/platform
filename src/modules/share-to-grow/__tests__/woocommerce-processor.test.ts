import { createHmac } from "node:crypto";
import { processWooCommerceOrder } from "../adapters/woocommerce-processor";
import { GENESIS_WOOCOMMERCE_ORDER_META } from "../adapters/woocommerce";
import { AppendOnlyLedger } from "../ledger";
import { resetShareToGrowRepositoryForTests } from "../share-to-grow-repository";

function webhook(sourceEventId: string) {
  const rawBody = JSON.stringify({ id: 78142, status: "processing" });
  const secret = "test-secret";
  return {
    secret,
    envelope: {
      sourceEventId,
      eventType: "order.created" as const,
      rawBody,
      signature: createHmac("sha256", secret).update(rawBody).digest("base64"),
      receivedAt: "2026-10-06T12:00:00Z",
    },
  };
}

function order() {
  return {
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
      inboundFreightDutyMinor: BigInt(100),
      fulfillmentPackagingMinor: BigInt(200),
      paymentProcessingMinor: BigInt(200),
    }],
  };
}

function twoUnitOrderWithShipping() {
  return {
    orderId: "665",
    organizationId: "stoner",
    currency: "USD",
    convertedAt: "2026-10-13T07:45:09Z",
    lines: [{
      lineItemId: "11",
      productId: "stoner-gym-performance-tee",
      quantity: 2,
      grossMerchandiseMinor: 12000n,
      customerShippingRevenueMinor: 900n,
      discountMinor: 0n,
      refundMinor: 0n,
      cogsMinor: 3600n,
      inboundFreightDutyMinor: 200n,
      outboundShippingLabelMinor: 900n,
      fulfillmentPackagingMinor: 200n,
      paymentProcessingMinor: 400n,
    }],
  };
}

describe("WooCommerce end-to-end processor", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("creator order becomes 50/35/15 earnings and Pending entitlements", async () => {
    const w = webhook("woo-creator-1");
    const ledger = new AppendOnlyLedger();
    const result = await processWooCommerceOrder({
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: order(),
      orderMeta: {
        [GENESIS_WOOCOMMERCE_ORDER_META.touchId]: "touch-jessica",
        [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: "tracking-jessica",
        [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "jessica",
      },
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger,
    });

    expect(result.replay).toBe(false);
    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("jessica")).toBe(BigInt(1295));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(555));
    expect(result.pendingEntitlements).toHaveLength(3);
    expect(result.pendingEntitlements.every((e) => e.state === "pending")).toBe(true);
  });

  test("Daniel direct order becomes 50/50", async () => {
    const w = webhook("woo-daniel-1");
    const ledger = new AppendOnlyLedger();
    await processWooCommerceOrder({
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: order(),
      orderMeta: {
        [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "daniel",
      },
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger,
    });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(1850));
  });

  test("canonical Daniel partner ID receives a 50/50 split", async () => {
    const w = webhook("woo-daniel-canonical-1");
    const ledger = new AppendOnlyLedger();
    const result = await processWooCommerceOrder({
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: order(),
      orderMeta: {
        [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "daniel-coffeen",
        [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: "tracking-stoner-gym-daniel-coffeen-v1",
      },
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger,
    });

    expect(result.attribution?.selectedPartnerId).toBe("daniel-coffeen");
    expect(result.processedLines[0]?.ruleVersionId).toBe("stoner-gym-daniel-direct-v1");
    expect(ledger.balanceMinor("stoner")).toBe(1850n);
    expect(ledger.balanceMinor("daniel")).toBe(1850n);
    expect(result.pendingEntitlements).toHaveLength(2);
  });

  test("two-unit Daniel direct order applies direct rule once per canonical line", async () => {
    const w = webhook("woo-daniel-665");
    const ledger = new AppendOnlyLedger();
    const result = await processWooCommerceOrder({
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: twoUnitOrderWithShipping(),
      orderMeta: {
        [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "daniel-coffeen",
        [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: "tracking-stoner-gym-daniel-coffeen-v1",
      },
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger,
    });

    expect(result.processedLines).toHaveLength(1);
    expect(result.processedLines[0]?.lineKey).toBe("woocommerce:665:11");
    expect(result.processedLines[0]?.ruleVersionId).toBe("stoner-gym-daniel-direct-v1");
    expect(ledger.balanceMinor("stoner")).toBe(3800n);
    expect(ledger.balanceMinor("daniel")).toBe(3800n);
  });

  test("organic order remains 100 percent STONER", async () => {
    const w = webhook("woo-organic-1");
    const ledger = new AppendOnlyLedger();
    await processWooCommerceOrder({
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: order(),
      orderMeta: {},
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger,
    });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(3700));
  });

  test("replayed webhook produces no second ledger or payout effect", async () => {
    const w = webhook("woo-replay-1");
    const ledger = new AppendOnlyLedger();
    const input = {
      webhook: w.envelope,
      webhookSecret: w.secret,
      order: order(),
      orderMeta: {
        [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "daniel",
      },
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [] as string[],
      ledger,
    };

    const first = await processWooCommerceOrder(input);
    const replay = await processWooCommerceOrder(input);

    expect(first.replay).toBe(false);
    expect(replay.replay).toBe(true);
    expect(replay.pendingEntitlements).toHaveLength(0);
    expect(ledger.entries()).toHaveLength(2);
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(1850));
  });
});
