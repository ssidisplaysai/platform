import { createHmac } from "node:crypto";
import { processWooCommerceWebhookHttp } from "../adapters/woocommerce-webhook-http";
import { auditWooCommerceOrder } from "../woocommerce-order-audit";
import * as repository from "../share-to-grow-repository";
import {
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const secret = "partial-refund-secret";

function order(id: number): string {
  return JSON.stringify({
    id, status: "processing", total: "60.00", currency: "USD",
    date_paid_gmt: "2026-10-07T01:37:55Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "t" },
      { key: "_genesis_tracking_identity_id", value: "tr" },
      { key: "_genesis_partner_id", value: "jessica" },
      { key: "_genesis_campaign_id", value: "C" },
    ],
    line_items: [{
      id: 2, product_id: 1, variation_id: 0, quantity: 1, subtotal: "60.00", total: "60.00",
      meta_data: [
        { key: "_genesis_cogs", value: "18.00" },
        { key: "_genesis_inbound_freight_duty", value: "1.00" },
        { key: "_genesis_fulfillment_packaging", value: "2.00" },
        { key: "_genesis_payment_processing", value: "2.00" },
      ],
    }],
  });
}

function refundBody(orderId: number, refundId: number, amount: string): string {
  return JSON.stringify({
    id: refundId, parent_id: orderId, amount, date_created_gmt: "2026-10-07T02:00:00Z",
    line_items: [{ id: 99, total: `-${amount}`, meta_data: [{ key: "_refunded_item_id", value: "2" }] }],
    tax_lines: [{ id: 5, tax_total: "-3.00" }],
    shipping_lines: [{ id: 6, total: "-4.00" }],
  });
}

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
  })) as ReturnType<typeof processWooCommerceWebhookHttp> & { refund?: Record<string, string> };
}

const net = async () => {
  const out: Record<string, bigint> = {};
  for (const entry of await (listPersistedLedgerEntries())) {
    out[entry.beneficiaryId] = (out[entry.beneficiaryId] ?? 0n) + BigInt(entry.amountMinor);
  }
  return out;
};
const total = async () => Object.values(await net()).reduce((sum, value) => sum + value, 0n);

describe("partial refund policy v1", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("$20 refund: 20 reversal split 10/7/3 on the locked rule, net 17, no brand loss", async () => {
    await (send("order.updated", "d-1", order(800)));
    const result = await (send("refund.created", "d-2", refundBody(800, 1, "20.00")));
    expect(result.economicDisposition).toBe("partially_reversed");
    expect(result.refund).toMatchObject({
      customerRefundAmount: "20.00",
      economicReversalAmount: "20.00",
      remainingNetDmp: "17.00",
      brandLossAmount: "0.00",
    });
    const reversals = (await listPersistedLedgerEntries()).filter((entry) => entry.entryType === "reversal");
    const by = Object.fromEntries(reversals.map((entry) => [entry.beneficiaryId, entry.amountMinor]));
    expect(by).toEqual({ stoner: "-1000", jessica: "-700", daniel: "-300" });
    expect(await (net())).toEqual({ stoner: 850n, jessica: 595n, daniel: 255n });
    expect(await (total())).toBe(1700n);
  });

  test("allocation sum equals reversal, originals retained and linked, rule preserved", async () => {
    await (send("order.updated", "d-1", order(801)));
    const before = (await listPersistedLedgerEntries()).filter((entry) => entry.entryType === "earning");
    await (send("refund.created", "d-2", refundBody(801, 1, "20.33")));
    const entries = await (listPersistedLedgerEntries());
    expect(entries.filter((entry) => entry.entryType === "earning")).toEqual(before);
    const reversals = entries.filter((entry) => entry.entryType === "reversal");
    expect(reversals.reduce((sum, entry) => sum - BigInt(entry.amountMinor), 0n)).toBe(2033n);
    for (const reversal of reversals) {
      expect(before.some((entry) => entry.id === reversal.sourceEntryId)).toBe(true);
    }
    const adjustment = (await listCommerceAdjustments())[0];
    expect(adjustment.lineAdjustments![0].ruleVersionId).toBeTruthy();
    expect(adjustment.lineAdjustments![0].originalDmpMinor).toBe("3700");
    expect(Object.values(await net()).every((value) => value >= 0n)).toBe(true);
  });

  test("partial then full refund reverses only the remaining 17", async () => {
    await (send("order.updated", "d-1", order(802)));
    await (send("refund.created", "d-2", refundBody(802, 1, "20.00")));
    const result = await (send("refund.created", "d-3", refundBody(802, 2, "40.00")));
    expect(result.economicDisposition).toBe("reversed");
    expect(result.refund).toMatchObject({ economicReversalAmount: "17.00", remainingNetDmp: "0.00" });
    expect(await (net())).toEqual({ stoner: 0n, jessica: 0n, daniel: 0n });
    expect((await listPersistedLedgerEntries()).filter((entry) => entry.entryType === "reversal")).toHaveLength(6);
  });

  test("refund of 50 against DMP 37 caps at 37 with 13 brand loss", async () => {
    await (send("order.updated", "d-1", order(803)));
    const result = await (send("refund.created", "d-2", refundBody(803, 1, "50.00")));
    expect(result.economicDisposition).toBe("reversed_with_brand_loss");
    expect(result.refund).toMatchObject({ economicReversalAmount: "37.00", brandLossAmount: "13.00" });
    expect(await (net())).toEqual({ stoner: 0n, jessica: 0n, daniel: 0n });
    expect((await listPersistedPayoutEntitlements()).every((entitlement) => BigInt(entitlement.amountMinor) > 0n)).toBe(true);
  });

  test("multiple partial refunds accumulate and never exceed original DMP", async () => {
    await (send("order.updated", "d-1", order(804)));
    await (send("refund.created", "d-2", refundBody(804, 1, "10.00")));
    await (send("refund.created", "d-3", refundBody(804, 2, "15.00")));
    expect(await (total())).toBe(1200n);
    await (send("refund.created", "d-4", refundBody(804, 3, "30.00")));
    expect(await (total())).toBe(0n);
    expect(Object.values(await net()).every((value) => value >= 0n)).toBe(true);
    const audit = await (auditWooCommerceOrder(804));
    expect(audit.economics.customerRefunded.amount).toBe("55.00");
    expect(audit.economics.economicReversed.amount).toBe("37.00");
    expect(audit.economics.brandLoss.amount).toBe("18.00");
    expect(audit.economics.netDmp.amount).toBe("0.00");
  });

  test("duplicate refund and different delivery for same refund have no extra effect", async () => {
    await (send("order.updated", "d-1", order(805)));
    const body = refundBody(805, 1, "20.00");
    await (send("refund.created", "d-2", body));
    expect((await send("refund.created", "d-2", body)).economicDisposition).toBe("replay");
    expect((await send("refund.created", "d-3", body)).economicDisposition).toBe("replay");
    expect(await (listCommerceAdjustments())).toHaveLength(1);
    expect(await (total())).toBe(1700n);
  });

  test("refund after full reversal creates no new reversal", async () => {
    await (send("order.updated", "d-1", order(806)));
    await (send("order.cancelled", "d-2", JSON.stringify({ id: 806, status: "cancelled" })));
    const count = (await listPersistedLedgerEntries()).length;
    const result = await (send("refund.created", "d-3", refundBody(806, 1, "10.00")));
    expect(result.economicDisposition).toBe("already_reversed");
    expect(await (listPersistedLedgerEntries())).toHaveLength(count);
  });

  test("cancellation after a partial reversal reverses only the remainder", async () => {
    await (send("order.updated", "d-1", order(807)));
    await (send("refund.created", "d-2", refundBody(807, 1, "20.00")));
    await (send("order.cancelled", "d-3", JSON.stringify({ id: 807, status: "cancelled" })));
    expect(await (total())).toBe(0n);
  });

  test("pending entitlement is reduced on partial refund and reversed at zero", async () => {
    await (send("order.updated", "d-1", order(808)));
    await (send("refund.created", "d-2", refundBody(808, 1, "20.00")));
    const amounts = (await listPersistedPayoutEntitlements()).map((entitlement) => [entitlement.beneficiaryId, entitlement.amountMinor, entitlement.state]);
    expect(amounts.sort()).toEqual([
      ["daniel", "255", "pending"],
      ["jessica", "595", "pending"],
      ["stoner", "850", "pending"],
    ]);
    await (send("refund.created", "d-3", refundBody(808, 2, "40.00")));
    expect((await listPersistedPayoutEntitlements()).every((entitlement) => entitlement.state === "reversed")).toBe(true);
  });

  test.each(["payable", "paid"])("%s entitlement requires manual review and writes no reversal", async (state) => {
    await (send("order.updated", "d-1", order(809)));
    const snapshot = await repository.loadShareToGrowRepositorySnapshot();
    const spy = jest.spyOn(repository, "loadShareToGrowRepositorySnapshot").mockResolvedValue({
      ...snapshot,
      state: {
        ...snapshot.state,
        payoutEntitlements: snapshot.state.payoutEntitlements.map((entitlement) => ({
          ...entitlement,
          state: state as "payable",
        })),
      },
    });
    const count = (await listPersistedLedgerEntries()).length;
    const result = await (send("refund.created", "d-2", refundBody(809, 1, "20.00")));
    expect(result.economicDisposition).toBe("manual_review_required");
    expect(result.reason).toBe("REFUND_AFTER_PAYOUT_THRESHOLD");
    expect(await (listPersistedLedgerEntries())).toHaveLength(count);
    spy.mockRestore();
  });

  test("legacy lines without a rule snapshot use the reference rule with the same id", async () => {
    await (send("order.updated", "d-1", order(813)));
    const snapshot = await repository.loadShareToGrowRepositorySnapshot();
    const stripped = snapshot.state.processedCommerceLines.map((line) => {
      const copy = { ...line };
      delete copy.ruleSnapshot;
      return copy;
    });
    const spy = jest.spyOn(repository, "loadShareToGrowRepositorySnapshot").mockResolvedValue({
      ...snapshot,
      state: { ...snapshot.state, processedCommerceLines: stripped },
    });
    await (send("refund.created", "d-2", refundBody(813, 1, "20.00")));
    spy.mockRestore();
    expect(await (net())).toEqual({ stoner: 850n, jessica: 595n, daniel: 255n });
  });

  test("tax and shipping refund lines are excluded and refund-only-tax is a no-op", async () => {
    await (send("order.updated", "d-1", order(810)));
    const taxOnly = JSON.stringify({
      id: 9, parent_id: 810, amount: "7.00", date_created_gmt: "2026-10-07T02:00:00Z",
      line_items: [], tax_lines: [{ id: 5, tax_total: "-3.00" }], shipping_lines: [{ id: 6, total: "-4.00" }],
    });
    expect((await send("refund.created", "d-2", taxOnly)).economicDisposition).toBe("ignored_no_economics");
    expect(await (total())).toBe(3700n);
    await (send("refund.created", "d-3", refundBody(810, 1, "20.00")));
    expect(await (total())).toBe(1700n);
  });

  test("no automatic cost credit: DMP never exceeds original and no earning is added", async () => {
    await (send("order.updated", "d-1", order(811)));
    await (send("refund.created", "d-2", refundBody(811, 1, "60.00")));
    expect((await listPersistedLedgerEntries()).filter((entry) => entry.entryType === "earning")).toHaveLength(3);
    expect((await listPersistedLedgerEntries()).filter((entry) => entry.entryType === "adjustment")).toHaveLength(0);
  });

  test("audit shows per-beneficiary gross, reversed, net after $20 refund", async () => {
    await (send("order.updated", "d-1", order(812)));
    await (send("refund.created", "d-2", refundBody(812, 1, "20.00")));
    const audit = await (auditWooCommerceOrder(812));
    expect(audit.economics.originalDmp.amount).toBe("37.00");
    expect(audit.economics.customerRefunded.amount).toBe("20.00");
    expect(audit.economics.netDmp.amount).toBe("17.00");
    expect(audit.economics.beneficiaries.map((row) => [row.beneficiary, row.grossEarning.amount, row.reversedAmount.amount, row.netEarning.amount])).toEqual([
      ["daniel", "5.55", "3.00", "2.55"],
      ["jessica", "12.95", "7.00", "5.95"],
      ["stoner", "18.50", "10.00", "8.50"],
    ]);
    expect(audit.processedLines[0].economics.netDmp.amount).toBe("17.00");
  });
});