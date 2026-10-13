import { createHmac } from "node:crypto";
import { processShopifyWebhookHttp } from "../adapters/shopify-webhook-http";
import {
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "shopify-http-secret";

function orderPayload(): string {
  return JSON.stringify({
    id: 19001,
    financial_status: "paid",
    currency: "USD",
    total_price: "60.00",
    created_at: "2026-10-13T05:01:00Z",
    processed_at: "2026-10-13T05:01:20Z",
    note_attributes: [
      { name: "genesis_touch_id", value: "touch-daniel-prod-001" },
      { name: "genesis_tracking_identity_id", value: "tracking-stoner-gym-daniel-coffeen-v1" },
      { name: "genesis_partner_id", value: "daniel" },
      { name: "genesis_campaign_id", value: "STONER-GYM-PRODUCTION" },
    ],
    line_items: [{
      id: 7001,
      product_id: 646,
      variant_id: 64601,
      quantity: 1,
      price: "60.00",
      total_discount: "0.00",
      properties: [
        { name: "genesis_cogs", value: "18.00" },
        { name: "genesis_inbound_freight_duty", value: "1.00" },
        { name: "genesis_fulfillment_packaging", value: "2.00" },
        { name: "genesis_payment_processing", value: "2.00" },
      ],
    }],
  });
}

function headers(rawBody: string) {
  return {
    "x-shopify-hmac-sha256": createHmac("sha256", secret).update(rawBody).digest("base64"),
    "x-shopify-topic": "orders/paid",
    "x-shopify-webhook-id": "shopify-delivery-19001",
  };
}

describe("Shopify webhook HTTP receiver", () => {
  beforeEach(async () => await resetShareToGrowRepositoryForTests());

  test("Daniel paid order creates 50/50 economics", async () => {
    const rawBody = orderPayload();
    const result = await processShopifyWebhookHttp({
      rawBody,
      headers: headers(rawBody),
      secret,
      receivedAt: "2026-10-13T05:02:00Z",
      recruitedCreatorPartnerIds: ["jessica"],
    });

    expect(result.replay).toBe(false);
    expect(result.selectedPartnerId).toBe("daniel");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].allocations).toEqual([
      { beneficiaryId: "stoner", amountMinor: "1850", currency: "USD" },
      { beneficiaryId: "daniel", amountMinor: "1850", currency: "USD" },
    ]);
    expect((await listPersistedLedgerEntries()).map((entry) => entry.amountMinor)).toEqual([
      "1850",
      "1850",
    ]);
    expect((await listPersistedPayoutEntitlements()).every((entitlement) => entitlement.state === "pending")).toBe(true);
  });

  test("rejects invalid signature", async () => {
    const rawBody = orderPayload();
    await expect(processShopifyWebhookHttp({
      rawBody,
      headers: {
        ...headers(rawBody),
        "x-shopify-hmac-sha256": "invalid",
      },
      secret,
      receivedAt: "2026-10-13T05:02:00Z",
      recruitedCreatorPartnerIds: [],
    })).rejects.toThrow("INVALID_SHOPIFY_WEBHOOK_SIGNATURE");
    expect(await listPersistedLedgerEntries()).toHaveLength(0);
  });
});
