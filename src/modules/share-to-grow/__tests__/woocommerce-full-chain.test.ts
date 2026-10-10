import { createHmac } from "node:crypto";
import { processRawWooCommerceOrder } from "../adapters/woocommerce-raw-processor";
import { AppendOnlyLedger } from "../ledger";
import {
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "full-chain-secret";

function rawCreatorOrder() {
  return JSON.stringify({
    id: 78142,
    status: "processing",
    currency: "USD",
    total: "60.00",
    date_paid_gmt: "2026-10-06T12:00:00Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "touch-jessica" },
      { key: "_genesis_tracking_identity_id", value: "tracking-jessica" },
      { key: "_genesis_partner_id", value: "jessica" },
      { key: "_genesis_campaign_id", value: "GYM-LAUNCH-01" },
    ],
    line_items: [{
      id: 9001,
      product_id: 501,
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

function envelope(sourceEventId: string, rawBody: string) {
  return {
    sourceEventId,
    eventType: "order.created" as const,
    rawBody,
    signature: createHmac("sha256", secret).update(rawBody).digest("base64"),
    receivedAt: "2026-10-06T12:00:01Z",
  };
}

describe("WooCommerce raw webhook full chain", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("signed real-shaped JSON becomes durable 50/35/15 economics and Pending payout", async () => {
    const rawBody = rawCreatorOrder();
    const ledger = new AppendOnlyLedger();
    const result = await (processRawWooCommerceOrder({
      webhook: envelope("raw-creator-1", rawBody),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger,
    }));

    expect(result.replay).toBe(false);
    expect(result.attribution.selectedPartnerId).toBe("jessica");
    expect(ledger.balanceMinor("stoner")).toBe(1850n);
    expect(ledger.balanceMinor("jessica")).toBe(1295n);
    expect(ledger.balanceMinor("daniel")).toBe(555n);
    expect(await (listProcessedCommerceLines())).toHaveLength(1);
    expect((await listPersistedLedgerEntries()).map((entry) => entry.amountMinor)).toEqual(["1850", "1295", "555"]);
    expect(await (listPersistedPayoutEntitlements())).toHaveLength(3);
    expect((await listPersistedPayoutEntitlements()).every((entry) => entry.state === "pending")).toBe(true);
  });

  test("tampering with the signed raw body is rejected before economics", async () => {
    const signed = rawCreatorOrder();
    const changed = signed.replace('"60.00"', '"600.00"');
    await expect(processRawWooCommerceOrder({
      webhook: { ...envelope("raw-tamper-1", signed), rawBody: changed },
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger: new AppendOnlyLedger(),
    })).rejects.toThrow("INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE");
    expect(await (listPersistedLedgerEntries())).toHaveLength(0);
  });

  test("exact webhook replay cannot duplicate durable economics", async () => {
    const rawBody = rawCreatorOrder();
    const ledger = new AppendOnlyLedger();
    const input = {
      webhook: envelope("raw-replay-1", rawBody),
      webhookSecret: secret,
      qualifiedTouches: [],
      recruitedCreatorPartnerIds: ["jessica"],
      ledger,
    };
    expect((await processRawWooCommerceOrder(input)).replay).toBe(false);
    expect((await processRawWooCommerceOrder(input)).replay).toBe(true);
    expect(await (listPersistedLedgerEntries())).toHaveLength(3);
    expect(await (listPersistedPayoutEntitlements())).toHaveLength(3);
  });
});
