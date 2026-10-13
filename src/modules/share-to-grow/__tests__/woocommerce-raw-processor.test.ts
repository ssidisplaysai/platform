import { createHmac } from "node:crypto";
import { processRawWooCommerceOrder } from "../adapters/woocommerce-raw-processor";
import { AppendOnlyLedger } from "../ledger";
import {
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "raw-order-verification-secret";

function webhook(rawBody: string, sourceEventId = "raw-order-1") {
  return {
    sourceEventId,
    eventType: "order.updated" as const,
    rawBody,
    signature: createHmac("sha256", secret).update(rawBody).digest("base64"),
    receivedAt: "2026-10-13T10:00:00Z",
  };
}

function paidOrder(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 666,
    status: "processing",
    currency: "USD",
    total: "120.00",
    date_paid_gmt: "2026-10-13T10:00:00Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "touch-daniel-test" },
      { key: "_genesis_tracking_identity_id", value: "tracking-stoner-gym-daniel-coffeen-v1" },
      { key: "_genesis_partner_id", value: "daniel-coffeen" },
      { key: "_genesis_campaign_id", value: "STONER-GYM-STAGING" },
    ],
    line_items: [{
      id: 12,
      product_id: 646,
      quantity: 2,
      subtotal: "120.00",
      total: "120.00",
      meta_data: [
        { key: "_genesis_cogs", value: "18.00" },
        { key: "_genesis_inbound_freight_duty", value: "1.00" },
        { key: "_genesis_fulfillment_packaging", value: "2.00" },
        { key: "_genesis_payment_processing", value: "2.00" },
      ],
    }],
    ...overrides,
  });
}

describe("WooCommerce authoritative order verification", () => {
  beforeEach(async () => await resetShareToGrowRepositoryForTests());

  test("processes verified paid orders", async () => {
    const rawBody = paidOrder();
    const result = await processRawWooCommerceOrder({
      webhook: webhook(rawBody),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => ({ authoritativeRawBody: rawBody }),
    });
    expect(result.economicDisposition).toBe("processed");
    expect(result.processedLines[0]?.ruleVersionId).toBe("stoner-gym-daniel-direct-v1");
    expect((await listPersistedLedgerEntries()).map((entry) => entry.amountMinor)).toEqual(["3700", "3700"]);
  });

  test("ignores authoritative on-hold orders", async () => {
    const webhookBody = paidOrder({ status: "on-hold", date_paid_gmt: null });
    const onHoldBody = paidOrder({ status: "on-hold", date_paid_gmt: null });
    const result = await processRawWooCommerceOrder({
      webhook: webhook(webhookBody),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => ({ authoritativeRawBody: onHoldBody }),
    });
    expect(result.economicDisposition).toBe("ignored_ineligible");
    expect(result.reason).toBe("ORDER_STATUS_INELIGIBLE");
    expect(await listPersistedLedgerEntries()).toHaveLength(0);
  });

  test("fails closed on webhook-authoritative mismatches", async () => {
    const webhookBody = paidOrder();
    const mismatchBody = paidOrder({ status: "on-hold" });
    await expect(processRawWooCommerceOrder({
      webhook: webhook(webhookBody),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => ({ authoritativeRawBody: mismatchBody }),
    })).rejects.toThrow("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  });

  test("fails closed when authoritative lookup is unavailable", async () => {
    await expect(processRawWooCommerceOrder({
      webhook: webhook(paidOrder()),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => {
        throw new Error("WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE");
      },
    })).rejects.toThrow("WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE");
    expect(await listPersistedLedgerEntries()).toHaveLength(0);
  });

  test("does not duplicate economics for duplicate delivery and existing line", async () => {
    const rawBody = paidOrder();
    const input = {
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [] as string[],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => ({ authoritativeRawBody: rawBody }),
    };
    const first = await processRawWooCommerceOrder({
      ...input,
      webhook: webhook(rawBody, "raw-dup-1"),
    });
    const replay = await processRawWooCommerceOrder({
      ...input,
      webhook: webhook(rawBody, "raw-dup-1"),
    });
    const existingLine = await processRawWooCommerceOrder({
      ...input,
      webhook: webhook(rawBody, "raw-dup-2"),
    });

    expect(first.economicDisposition).toBe("processed");
    expect(replay.economicDisposition).toBe("replay");
    expect(existingLine.economicDisposition).toBe("replay");
    expect(await listProcessedCommerceLines()).toHaveLength(1);
    expect(await listPersistedLedgerEntries()).toHaveLength(2);
    expect(await listPersistedPayoutEntitlements()).toHaveLength(2);
  });

  test("requires cost completeness from either line or order-level source", async () => {
    const missingCostSource = paidOrder({
      line_items: [{
        id: 12,
        product_id: 646,
        quantity: 2,
        subtotal: "120.00",
        total: "120.00",
        meta_data: [
          { key: "_genesis_cogs", value: "18.00" },
          { key: "_genesis_inbound_freight_duty", value: "1.00" },
        ],
      }],
    });
    await expect(processRawWooCommerceOrder({
      webhook: webhook(missingCostSource),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: [],
      ledger: new AppendOnlyLedger(),
      authoritativeOrderVerifier: async () => ({ authoritativeRawBody: missingCostSource }),
    })).rejects.toThrow("MISSING_WOOCOMMERCE_COST_SOURCE");
  });
});
