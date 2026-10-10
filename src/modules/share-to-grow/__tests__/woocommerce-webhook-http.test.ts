import { createHmac } from "node:crypto";
import { processWooCommerceWebhookHttp } from "../adapters/woocommerce-webhook-http";
import {
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "receiver-test-secret";

function rawOrder(): string {
  return JSON.stringify({
    id: 650,
    status: "processing",
    total: "60.00",
    date_paid_gmt: "2026-10-07T01:37:55Z",
    currency: "USD",
    date_created_gmt: "2026-10-07T01:37:51Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "touch-jessica-staging-001" },
      { key: "_genesis_tracking_identity_id", value: "tracking-jessica-staging" },
      { key: "_genesis_partner_id", value: "jessica" },
      { key: "_genesis_campaign_id", value: "GYM-LAUNCH-STAGING-01" },
    ],
    line_items: [{
      id: 1,
      product_id: 646,
      variation_id: 0,
      quantity: 1,
      subtotal: "60.00",
      total: "60.00",
      meta_data: [
        { key: "_genesis_cogs", value: "18.00" },
        { key: "_genesis_inbound_freight_duty", value: "1.00" },
        { key: "_genesis_fulfillment_packaging", value: "2.00" },
        { key: "_genesis_payment_processing", value: "2.00" },
      ],
    }],
  });
}

function headers(rawBody: string) {
  return {
    "x-wc-webhook-signature": createHmac("sha256", secret).update(rawBody).digest("base64"),
    "x-wc-webhook-topic": "order.created",
    "x-wc-webhook-delivery-id": "woo-staging-order-650",
  };
}

describe("WooCommerce webhook HTTP receiver", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("real staging-shaped order becomes durable creator allocations", async () => {
    const rawBody = rawOrder();
    const result = await processWooCommerceWebhookHttp({
      rawBody,
      headers: headers(rawBody),
      secret,
      receivedAt: "2026-10-07T01:38:00Z",
      recruitedCreatorPartnerIds: ["jessica"],
    });

    expect(result.replay).toBe(false);
    expect(result.selectedPartnerId).toBe("jessica");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].allocations).toEqual([
      { beneficiaryId: "stoner", amountMinor: "1850", currency: "USD" },
      { beneficiaryId: "jessica", amountMinor: "1295", currency: "USD" },
      { beneficiaryId: "daniel", amountMinor: "555", currency: "USD" },
    ]);
    expect((await listPersistedLedgerEntries()).map((entry) => entry.amountMinor)).toEqual([
      "1850",
      "1295",
      "555",
    ]);
    const entitlements = await listPersistedPayoutEntitlements();
    expect(entitlements).toHaveLength(3);
    expect(entitlements.every((entry) => entry.state === "pending")).toBe(true);
  });

  test("invalid signature is rejected before durable economics", async () => {
    const rawBody = rawOrder();
    await expect(processWooCommerceWebhookHttp({
      rawBody,
      headers: {
        ...headers(rawBody),
        "x-wc-webhook-signature": "invalid",
      },
      secret,
      receivedAt: "2026-10-07T01:38:00Z",
      recruitedCreatorPartnerIds: ["jessica"],
    })).rejects.toThrow("INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE");
    expect(await listPersistedLedgerEntries()).toHaveLength(0);
  });

  test("exact delivery replay cannot duplicate economics", async () => {
    const rawBody = rawOrder();
    const input = {
      rawBody,
      headers: headers(rawBody),
      secret,
      receivedAt: "2026-10-07T01:38:00Z",
      recruitedCreatorPartnerIds: ["jessica"],
    };
    expect((await processWooCommerceWebhookHttp(input)).replay).toBe(false);
    expect((await processWooCommerceWebhookHttp(input)).replay).toBe(true);
    expect(await listPersistedLedgerEntries()).toHaveLength(3);
    expect(await listPersistedPayoutEntitlements()).toHaveLength(3);
  });
});
