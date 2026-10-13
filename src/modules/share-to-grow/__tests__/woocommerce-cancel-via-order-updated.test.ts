import { createHmac } from "node:crypto";
import { processWooCommerceWebhookHttp } from "../adapters/woocommerce-webhook-http";
import { auditWooCommerceOrder } from "../woocommerce-order-audit";
import {
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "cancel-via-update-secret";

function order(id: number, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id,
    status: "processing",
    total: "60.00",
    currency: "USD",
    date_paid_gmt: "2026-10-07T01:37:55Z",
    date_created_gmt: "2026-10-07T01:37:51Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "touch-jessica" },
      { key: "_genesis_tracking_identity_id", value: "tracking-jessica" },
      { key: "_genesis_partner_id", value: "jessica" },
      { key: "_genesis_campaign_id", value: "GYM" },
    ],
    line_items: [{
      id: 2,
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
    ...overrides,
  });
}

const cancelled = (id: number) => order(id, { status: "cancelled" });

async function send(topic: string, deliveryId: string, rawBody: string) {
  return await (processWooCommerceWebhookHttp({
    rawBody,
    headers: {
      "x-wc-webhook-signature": createHmac("sha256", secret).update(rawBody).digest("base64"),
      "x-wc-webhook-topic": topic,
      "x-wc-webhook-delivery-id": deliveryId,
    },
    secret,
    receivedAt: "2026-10-07T02:00:00Z",
    recruitedCreatorPartnerIds: ["jessica"],
  }));
}

const sumMinor = async () => (await listPersistedLedgerEntries()).reduce((total, entry) => total + BigInt(entry.amountMinor), 0n);

describe("order.updated status=cancelled is a cancellation", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("paid order.updated creates normal economics", async () => {
    expect((await send("order.updated", "d-1", order(800))).economicDisposition).toBe("processed");
    expect(await (listPersistedLedgerEntries())).toHaveLength(3);
  });

  test("unpaid order.updated is ignored_ineligible", async () => {
    const result = await (send("order.updated", "d-1", order(801, { status: "on-hold", date_paid_gmt: null })));
    expect(result.economicDisposition).toBe("ignored_ineligible");
    expect(await (listPersistedLedgerEntries())).toHaveLength(0);
  });

  test("cancelled order.updated after economics fully reverses and keeps originals", async () => {
    await (send("order.updated", "d-1", order(802)));
    const originals = await (listPersistedLedgerEntries());
    const result = await (send("order.updated", "d-2", cancelled(802)));
    expect(result.economicDisposition).toBe("reversed");
    expect(result.reversals).toHaveLength(3);
    const after = await (listPersistedLedgerEntries());
    expect(after).toHaveLength(6);
    expect(after.filter((entry) => entry.entryType === "earning")).toEqual(originals);
    expect(after.filter((entry) => entry.entryType === "reversal").every((entry) => entry.sourceEntryId)).toBe(true);
    expect(await (sumMinor())).toBe(0n);
    expect((await listPersistedPayoutEntitlements()).every((entitlement) => entitlement.state === "reversed")).toBe(true);
    const audit = await (auditWooCommerceOrder(802));
    expect(audit.economics.originalDmp.amount).toBe("37.00");
    expect(audit.economics.netDmp.amount).toBe("0.00");
  });

  test("repeat and different-delivery cancelled updates add no second reversal", async () => {
    await (send("order.updated", "d-1", order(803)));
    await (send("order.updated", "d-2", cancelled(803)));
    expect((await send("order.updated", "d-2", cancelled(803))).economicDisposition).toBe("replay");
    expect((await send("order.updated", "d-3", cancelled(803))).economicDisposition).toBe("replay");
    expect((await send("order.updated", "d-4", order(803, { status: "cancelled", date_modified_gmt: "2026-10-07T05:00:00Z" }))).economicDisposition).toBe("replay");
    expect(await (listPersistedLedgerEntries())).toHaveLength(6);
    expect((await listCommerceAdjustments()).filter((record) => record.kind === "cancellation")).toHaveLength(1);
  });

  test("explicit order.cancelled and order.updated converge on the same operation", async () => {
    await (send("order.updated", "d-1", order(804)));
    await (send("order.cancelled", "d-2", JSON.stringify({ id: 804, status: "cancelled" })));
    expect((await send("order.updated", "d-3", cancelled(804))).economicDisposition).toBe("replay");
    expect(await (listPersistedLedgerEntries())).toHaveLength(6);
    expect((await listCommerceAdjustments()).map((record) => record.adjustmentId)).toEqual(["cancellation:804"]);
  });

  test("cancellation after a full refund does not double reverse", async () => {
    await (send("order.updated", "d-1", order(805)));
    await (send("refund.created", "d-2", JSON.stringify({
      id: 9001,
      parent_id: 805,
      date_created_gmt: "2026-10-07T02:00:00Z",
      line_items: [{ id: 77, total: "-60.00", meta_data: [{ key: "_refunded_item_id", value: "2" }] }],
    })));
    await (send("order.updated", "d-3", cancelled(805)));
    expect(await (listPersistedLedgerEntries())).toHaveLength(6);
    expect(await (sumMinor())).toBe(0n);
  });

  test("cancelled order cannot be resurrected by a later ordinary update", async () => {
    await (send("order.updated", "d-1", order(806)));
    await (send("order.updated", "d-2", cancelled(806)));
    await (send("order.updated", "d-3", order(806)));
    expect(await (listPersistedLedgerEntries())).toHaveLength(6);
    expect(await (sumMinor())).toBe(0n);
  });

  test("cancelled update for an order with no economics is a no-op", async () => {
    const result = await (send("order.updated", "d-1", cancelled(807)));
    expect(result.economicDisposition).toBe("ignored_no_economics");
    expect(await (listPersistedLedgerEntries())).toHaveLength(0);
  });

  test("an invalid signature on a cancelled update is rejected without effects", async () => {
    await (send("order.updated", "d-1", order(808)));
    const rawBody = cancelled(808);
    await expect(processWooCommerceWebhookHttp({
      rawBody,
      headers: {
        "x-wc-webhook-signature": createHmac("sha256", "wrong").update(rawBody).digest("base64"),
        "x-wc-webhook-topic": "order.updated",
        "x-wc-webhook-delivery-id": "d-bad",
      },
      secret,
      receivedAt: "2026-10-07T02:00:00Z",
      recruitedCreatorPartnerIds: ["jessica"],
    })).rejects.toThrow();
    expect(await (listPersistedLedgerEntries())).toHaveLength(3);
  });
});
