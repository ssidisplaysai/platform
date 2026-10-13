import { createHmac } from "node:crypto";
import { processShopifyWebhookHttp } from "../adapters/shopify-webhook-http";
import {
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "shopify-refund-secret";

function order(orderId: number): string {
  return JSON.stringify({
    id: orderId,
    financial_status: "paid",
    currency: "USD",
    total_price: "60.00",
    created_at: "2026-10-13T06:00:00Z",
    processed_at: "2026-10-13T06:00:10Z",
    note_attributes: [
      { name: "genesis_partner_id", value: "jessica" },
      { name: "genesis_tracking_identity_id", value: "tracking-jessica-staging" },
    ],
    line_items: [{
      id: 71,
      product_id: 1,
      variant_id: 1,
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

function refund(orderId: number, refundId: number, amount: string): string {
  return JSON.stringify({
    id: refundId,
    order_id: orderId,
    created_at: "2026-10-13T06:30:00Z",
    refund_line_items: [
      {
        line_item: { id: 71 },
        subtotal: amount,
      },
    ],
  });
}

async function send(topic: string, deliveryId: string, rawBody: string) {
  return processShopifyWebhookHttp({
    rawBody,
    headers: {
      "x-shopify-hmac-sha256": createHmac("sha256", secret).update(rawBody).digest("base64"),
      "x-shopify-topic": topic,
      "x-shopify-webhook-id": deliveryId,
    },
    secret,
    receivedAt: "2026-10-13T06:40:00Z",
    recruitedCreatorPartnerIds: ["jessica"],
  });
}

const netTotal = async () => (await listPersistedLedgerEntries()).reduce(
  (sum, entry) => sum + BigInt(entry.amountMinor),
  0n,
);

describe("Shopify refund/cancel parity", () => {
  beforeEach(async () => await resetShareToGrowRepositoryForTests());

  test("partial refund reverses proportionally", async () => {
    await send("orders/paid", "s-1", order(9501));
    const result = await send("refunds/create", "s-2", refund(9501, 1, "20.00"));
    expect(result.economicDisposition).toBe("partially_reversed");
    expect(await netTotal()).toBe(1700n);
  });

  test("duplicate refund replay does not duplicate economics", async () => {
    await send("orders/paid", "s-1", order(9502));
    const body = refund(9502, 1, "20.00");
    await send("refunds/create", "s-2", body);
    expect((await send("refunds/create", "s-3", body)).economicDisposition).toBe("replay");
    expect(await listCommerceAdjustments()).toHaveLength(1);
  });

  test("over-refund is capped with brand loss", async () => {
    await send("orders/paid", "s-1", order(9503));
    const result = await send("refunds/create", "s-2", refund(9503, 1, "50.00"));
    expect(result.economicDisposition).toBe("reversed_with_brand_loss");
    expect(await netTotal()).toBe(0n);
  });

  test("cancelled order reverses remaining balance once", async () => {
    await send("orders/paid", "s-1", order(9504));
    await send("orders/updated", "s-2", JSON.stringify({ id: 9504, cancelled_at: "2026-10-13T06:50:00Z" }));
    expect(await netTotal()).toBe(0n);
    expect((await send("orders/cancelled", "s-3", JSON.stringify({ id: 9504, cancelled_at: "2026-10-13T06:50:00Z" }))).economicDisposition).toBe("replay");
  });
});
