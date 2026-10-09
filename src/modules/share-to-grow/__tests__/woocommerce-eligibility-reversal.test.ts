import { createHmac } from "node:crypto";
import { processWooCommerceWebhookHttp } from "../adapters/woocommerce-webhook-http";
import { evaluateWooCommerceOrderEligibility } from "../adapters/woocommerce-eligibility";
import { parseWooCommerceOrderEligibilityFacts } from "../adapters/woocommerce-payloads";
import { auditWooCommerceOrder } from "../woocommerce-order-audit";
import {
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
  listSourceEventReceipts,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "eligibility-test-secret";

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

function refundBody(orderId: number, refundId: number, amount: string, lineId = 2): string {
  return JSON.stringify({
    id: refundId,
    parent_id: orderId,
    date_created_gmt: "2026-10-07T02:00:00Z",
    amount,
    line_items: [{ id: 99, total: `-${amount}`, meta_data: [{ key: "_refunded_item_id", value: String(lineId) }] }],
  });
}

function send(topic: string, deliveryId: string, rawBody: string) {
  return processWooCommerceWebhookHttp({
    rawBody,
    headers: {
      "x-wc-webhook-signature": createHmac("sha256", secret).update(rawBody).digest("base64"),
      "x-wc-webhook-topic": topic,
      "x-wc-webhook-delivery-id": deliveryId,
    },
    secret,
    receivedAt: "2026-10-07T02:00:00Z",
    recruitedCreatorPartnerIds: ["jessica"],
  });
}

const sumMinor = () => listPersistedLedgerEntries().reduce((total, entry) => total + BigInt(entry.amountMinor), 0n);

describe("WooCommerce eligibility gate", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test.each(["processing", "completed"])("%s paid order is eligible", (status) => {
    const result = send("order.updated", `d-${status}`, order(700, { status }));
    expect(result.economicDisposition).toBe("processed");
    expect(listPersistedLedgerEntries()).toHaveLength(3);
  });

  test.each(["pending", "on-hold", "failed", "cancelled", "refunded", "draft"])(
    "%s order is ignored with receipt only",
    (status) => {
      const result = send("order.created", `d-${status}`, order(701, { status }));
      expect(result.economicDisposition).toBe("ignored_ineligible");
      expect(result.reason).toBe("ORDER_STATUS_INELIGIBLE");
      expect(listPersistedLedgerEntries()).toHaveLength(0);
      expect(listProcessedCommerceLines()).toHaveLength(0);
      expect(listPersistedPayoutEntitlements()).toHaveLength(0);
      expect(listSourceEventReceipts()).toHaveLength(1);
    },
  );

  test("missing paid date is ignored", () => {
    const result = send("order.updated", "d-nopaid", order(702, { date_paid_gmt: null }));
    expect(result.economicDisposition).toBe("ignored_ineligible");
    expect(result.reason).toBe("ORDER_NOT_PAID");
    expect(listPersistedLedgerEntries()).toHaveLength(0);
  });

  test("unpaid order without cost meta does not fail", () => {
    const body = JSON.stringify({ id: 703, status: "on-hold", total: "60.00", line_items: [{ id: 1 }] });
    expect(send("order.created", "d-bare", body).economicDisposition).toBe("ignored_ineligible");
  });

  test("ignored order later paid becomes economically processed", () => {
    send("order.created", "d-1", order(704, { status: "on-hold", date_paid_gmt: null }));
    const paid = send("order.updated", "d-2", order(704));
    expect(paid.economicDisposition).toBe("processed");
    expect(listPersistedLedgerEntries()).toHaveLength(3);
  });

  test("replay of eligible order creates no new economics", () => {
    send("order.updated", "d-1", order(705));
    const again = send("order.updated", "d-2", order(705));
    expect(again.economicDisposition).toBe("replay");
    expect(listPersistedLedgerEntries()).toHaveLength(3);
    expect(listProcessedCommerceLines()).toHaveLength(1);
  });

  test("eligibility rules are deterministic and reject refunded or zero-total orders", () => {
    const facts = (raw: string) => parseWooCommerceOrderEligibilityFacts(raw);
    expect(evaluateWooCommerceOrderEligibility(facts(order(1)))).toEqual(
      evaluateWooCommerceOrderEligibility(facts(order(1))),
    );
    expect(evaluateWooCommerceOrderEligibility(facts(order(1, { total: "0.00" }))).eligible).toBe(false);
  });
});

describe("WooCommerce cancellation reversal", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test("cancellation appends exact reversals, keeps originals, nets to zero", () => {
    send("order.updated", "d-1", order(710));
    const before = listPersistedLedgerEntries();
    const result = send("order.cancelled", "d-2", JSON.stringify({ id: 710, status: "cancelled" }));
    expect(result.economicDisposition).toBe("reversed");
    const after = listPersistedLedgerEntries();
    expect(after).toHaveLength(6);
    expect(after.filter((entry) => entry.entryType === "earning")).toEqual(before);
    const reversals = after.filter((entry) => entry.entryType === "reversal");
    expect(reversals).toHaveLength(3);
    for (const reversal of reversals) {
      const source = before.find((entry) => entry.id === reversal.sourceEntryId)!;
      expect(source).toBeDefined();
      expect(BigInt(reversal.amountMinor)).toBe(-BigInt(source.amountMinor));
      expect(reversal.beneficiaryId).toBe(source.beneficiaryId);
    }
    expect(sumMinor()).toBe(0n);
    expect(listPersistedPayoutEntitlements().every((entitlement) => entitlement.state === "reversed")).toBe(true);
  });

  test("repeat and different-delivery cancellations add nothing", () => {
    send("order.updated", "d-1", order(711));
    const body = JSON.stringify({ id: 711, status: "cancelled" });
    send("order.cancelled", "d-2", body);
    expect(send("order.cancelled", "d-2", body).economicDisposition).toBe("replay");
    expect(send("order.cancelled", "d-3", body).economicDisposition).toBe("replay");
    expect(listPersistedLedgerEntries()).toHaveLength(6);
  });

  test("cancelling an unknown order is a no-op", () => {
    const result = send("order.cancelled", "d-1", JSON.stringify({ id: 9999, status: "cancelled" }));
    expect(result.economicDisposition).toBe("ignored_no_economics");
    expect(listPersistedLedgerEntries()).toHaveLength(0);
  });

  test("later order update cannot resurrect a cancelled order", () => {
    send("order.updated", "d-1", order(712));
    send("order.cancelled", "d-2", JSON.stringify({ id: 712, status: "cancelled" }));
    send("order.updated", "d-3", order(712));
    expect(listPersistedLedgerEntries()).toHaveLength(6);
    expect(sumMinor()).toBe(0n);
  });

  test("cancellation payload must be cancelled", () => {
    expect(() => send("order.cancelled", "d-1", JSON.stringify({ id: 1, status: "processing" }))).toThrow(
      "INVALID_WOOCOMMERCE_CANCELLATION_STATUS",
    );
  });

  test("reversed entitlements cannot become payable", () => {
    send("order.updated", "d-1", order(713));
    send("order.cancelled", "d-2", JSON.stringify({ id: 713, status: "cancelled" }));
    expect(listPersistedPayoutEntitlements().some((entitlement) => entitlement.state === "payable")).toBe(false);
  });
});

describe("WooCommerce refund reversal", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test("full refund reverses and duplicate refund is idempotent", () => {
    send("order.updated", "d-1", order(720));
    const result = send("refund.created", "d-2", refundBody(720, 5001, "60.00"));
    expect(result.economicDisposition).toBe("reversed");
    expect(sumMinor()).toBe(0n);
    expect(send("refund.created", "d-3", refundBody(720, 5001, "60.00")).economicDisposition).toBe("replay");
    expect(listPersistedLedgerEntries()).toHaveLength(6);
  });

  test("over-refund fails closed", () => {
    send("order.updated", "d-1", order(723));
    const result = send("refund.created", "d-2", refundBody(723, 5005, "70.00"));
    expect(result.economicDisposition).toBe("manual_review_required");
    expect(result.reason).toBe("REFUND_EXCEEDS_LINE_SALE");
    expect(listPersistedLedgerEntries()).toHaveLength(3);
  });

  test("refund before economics is a no-op", () => {
    const result = send("refund.created", "d-1", refundBody(724, 5006, "60.00"));
    expect(result.economicDisposition).toBe("ignored_no_economics");
  });

  test("cancel after full refund does not double reverse", () => {
    send("order.updated", "d-1", order(725));
    send("refund.created", "d-2", refundBody(725, 5007, "60.00"));
    send("order.cancelled", "d-3", JSON.stringify({ id: 725, status: "cancelled" }));
    expect(listPersistedLedgerEntries()).toHaveLength(6);
    expect(sumMinor()).toBe(0n);
  });
});

describe("WooCommerce audit with reversals", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test("#652-equivalent economics are unchanged", () => {
    send("order.updated", "d-1", order(652));
    const audit = auditWooCommerceOrder(652);
    expect(audit.economics.originalDmp.amount).toBe("37.00");
    expect(audit.economics.netDmp.amount).toBe("37.00");
    expect(audit.economics.beneficiaries.map((row) => [row.beneficiary, row.netEarning.amount])).toEqual([
      ["daniel", "5.55"],
      ["jessica", "12.95"],
      ["stoner", "18.50"],
    ]);
    expect(audit.adjustments).toEqual([]);
  });

  test("audit shows reversal, net zero, reversed entitlement and excludes other orders", () => {
    send("order.updated", "d-1", order(730));
    send("order.updated", "d-2", order(731));
    send("order.cancelled", "d-3", JSON.stringify({ id: 730, status: "cancelled" }));
    const audit = auditWooCommerceOrder(730);
    expect(audit.economics.originalDmp.amount).toBe("37.00");
    expect(audit.economics.reversedDmp.amount).toBe("37.00");
    expect(audit.economics.netDmp.amount).toBe("0.00");
    expect(audit.adjustments).toHaveLength(1);
    expect(audit.adjustments[0].kind).toBe("cancellation");
    expect(audit.entitlements.every((entitlement) => entitlement.lifecycle === "reversed")).toBe(true);
    expect(audit.processedLines[0].idempotency.reversalEntryCount).toBe(3);
    expect(JSON.stringify(audit)).not.toContain("woocommerce:731:");
    expect(JSON.stringify(auditWooCommerceOrder(730))).toBe(JSON.stringify(audit));
  });

  test("audit performs no writes", () => {
    send("order.updated", "d-1", order(732));
    const snapshot = JSON.stringify([listPersistedLedgerEntries(), listCommerceAdjustments(), listSourceEventReceipts()]);
    auditWooCommerceOrder(732);
    expect(JSON.stringify([listPersistedLedgerEntries(), listCommerceAdjustments(), listSourceEventReceipts()])).toBe(snapshot);
  });
});
