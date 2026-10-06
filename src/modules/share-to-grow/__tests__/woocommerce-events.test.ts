import { createHmac } from "node:crypto";
import { acceptWooCommerceWebhook } from "../adapters/woocommerce-events";
import { postProportionalRefund } from "../adapters/woocommerce-refunds";
import { AppendOnlyLedger } from "../ledger";
import { money } from "../money";
import {
  resetShareToGrowRepositoryForTests,
  listSourceEventReceipts,
} from "../share-to-grow-repository";

describe("WooCommerce event ingestion", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test("verifies HMAC and makes webhook replay idempotent", () => {
    const rawBody = JSON.stringify({ id: 78142, status: "processing" });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
    const envelope = {
      sourceEventId: "woo-event-1",
      eventType: "order.created" as const,
      rawBody,
      signature,
      receivedAt: "2026-10-06T12:00:00Z",
    };

    expect(acceptWooCommerceWebhook(envelope, secret).replay).toBe(false);
    expect(acceptWooCommerceWebhook(envelope, secret).replay).toBe(true);
    expect(listSourceEventReceipts()).toHaveLength(1);
  });

  test("rejects invalid signature and event-id payload collision", () => {
    const secret = "test-secret";
    const body = "{}";
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    acceptWooCommerceWebhook({
      sourceEventId: "woo-event-2", eventType: "order.updated",
      rawBody: body, signature, receivedAt: "2026-10-06T12:00:00Z",
    }, secret);

    const otherBody = '{"changed":true}';
    const otherSignature = createHmac("sha256", secret).update(otherBody).digest("base64");
    expect(() => acceptWooCommerceWebhook({
      sourceEventId: "woo-event-2", eventType: "order.updated",
      rawBody: otherBody, signature: otherSignature, receivedAt: "2026-10-06T12:01:00Z",
    }, secret)).toThrow("SOURCE_EVENT_ID_COLLISION");

    expect(() => acceptWooCommerceWebhook({
      sourceEventId: "bad", eventType: "order.created",
      rawBody: body, signature: "bad", receivedAt: "2026-10-06T12:00:00Z",
    }, secret)).toThrow("INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE");
  });

  test("posts partial refund proportionally without rewriting original earnings", () => {
    const ledger = new AppendOnlyLedger();
    const entries = [
      ledger.post({ id:"e-stoner", idempotencyKey:"e-stoner", beneficiaryId:"stoner", entryType:"earning", amount:money(1850n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
      ledger.post({ id:"e-creator", idempotencyKey:"e-creator", beneficiaryId:"creator", entryType:"earning", amount:money(1295n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
      ledger.post({ id:"e-daniel", idempotencyKey:"e-daniel", beneficiaryId:"daniel", entryType:"earning", amount:money(555n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
    ];

    const adjustments = postProportionalRefund({
      ledger, sourceEntries:entries, refundDmpMinor:1850n, originalDmpMinor:3700n,
      refundEventId:"refund-1", postedAt:"2026-10-07T12:00:00Z",
    });

    expect(adjustments.reduce((s,e)=>s+e.amount.minor,0n)).toBe(-1850n);
    expect(ledger.entries()).toHaveLength(6);
    expect(ledger.balanceMinor("stoner")).toBe(925n);
    expect(ledger.balanceMinor("creator")).toBe(648n);
    expect(ledger.balanceMinor("daniel")).toBe(277n);
  });

  test("full refund zeros all beneficiary balances and replay is ledger-idempotent", () => {
    const ledger = new AppendOnlyLedger();
    const entries = [
      ledger.post({ id:"f-stoner", idempotencyKey:"f-stoner", beneficiaryId:"stoner", entryType:"earning", amount:money(1850n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
      ledger.post({ id:"f-creator", idempotencyKey:"f-creator", beneficiaryId:"creator", entryType:"earning", amount:money(1295n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
      ledger.post({ id:"f-daniel", idempotencyKey:"f-daniel", beneficiaryId:"daniel", entryType:"earning", amount:money(555n,"USD"), postedAt:"2026-10-06T12:00:00Z" }),
    ];
    const input={ledger,sourceEntries:entries,refundDmpMinor:3700n,originalDmpMinor:3700n,refundEventId:"refund-full",postedAt:"2026-10-07T12:00:00Z"};
    postProportionalRefund(input);
    postProportionalRefund(input);
    expect(ledger.entries()).toHaveLength(6);
    expect(ledger.balanceMinor("stoner")).toBe(0n);
    expect(ledger.balanceMinor("creator")).toBe(0n);
    expect(ledger.balanceMinor("daniel")).toBe(0n);
  });
});
