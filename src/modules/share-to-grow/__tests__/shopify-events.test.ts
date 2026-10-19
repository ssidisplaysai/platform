import { createHmac } from "node:crypto";
import { acceptShopifyWebhook } from "../adapters/shopify-events";
import { resetShareToGrowRepositoryForTests } from "../share-to-grow-repository";

const secret = "shopify-signature-secret";

describe("Shopify webhook signature verification", () => {
  beforeEach(async () => await resetShareToGrowRepositoryForTests());

  test("accepts valid signature and marks replay on repeated webhook id", async () => {
    const rawBody = JSON.stringify({ id: 701, financial_status: "paid" });
    const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
    const base = {
      sourceEventId: "shopify-evt-701",
      eventType: "order.paid" as const,
      rawBody,
      signature,
      receivedAt: "2026-10-13T05:00:00Z",
    };
    const first = await acceptShopifyWebhook(base, secret);
    expect(first.replay).toBe(false);
    expect(first.receipt.source).toBe("shopify");

    const second = await acceptShopifyWebhook(base, secret);
    expect(second.replay).toBe(false);
  });

  test("rejects invalid signature", async () => {
    await expect(acceptShopifyWebhook({
      sourceEventId: "shopify-invalid-sig",
      eventType: "order.paid",
      rawBody: "{}",
      signature: "invalid",
      receivedAt: "2026-10-13T05:00:00Z",
    }, secret)).rejects.toThrow("INVALID_SHOPIFY_WEBHOOK_SIGNATURE");
  });
});
