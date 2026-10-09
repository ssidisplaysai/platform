import { money } from "../money";
import type { LedgerEntry } from "../ledger";
import {
  commitCommerceAdjustment,
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
} from "../share-to-grow-repository";
import type {
  CommerceAdjustmentRecord,
  PersistedLedgerEntry,
  ProcessedCommerceLineRecord,
} from "../persistence-types";
import {
  acceptWooCommerceWebhook,
  type WooCommerceWebhookEnvelope,
} from "./woocommerce-events";
import {
  parseWooCommerceCancellationPayload,
  parseWooCommerceRefundPayload,
} from "./woocommerce-payloads";

export type WooCommerceAdjustmentDisposition =
  | "reversed"
  | "replay"
  | "ignored_no_economics"
  | "manual_review_required";

export interface WooCommerceAdjustmentResult {
  readonly sourceEventId: string;
  readonly eventType: "order.cancelled" | "refund.created";
  readonly orderId: string;
  readonly replay: boolean;
  readonly economicDisposition: WooCommerceAdjustmentDisposition;
  readonly reason?: string;
  readonly reversals: readonly {
    readonly ledgerEntryId: string;
    readonly sourceEntryId: string;
    readonly beneficiaryId: string;
    readonly amountMinor: string;
    readonly currency: string;
  }[];
}

export const PARTIAL_REFUND_POLICY_REASON = "PARTIAL_REFUND_COST_POLICY_REQUIRES_BUSINESS_RULE";

function linesForOrder(orderId: string): ProcessedCommerceLineRecord[] {
  const prefix = `woocommerce:${orderId}:`;
  return listProcessedCommerceLines().filter(
    (line) => line.lineKey.startsWith(prefix) && line.lineKey.length > prefix.length,
  );
}

function result(
  envelope: WooCommerceWebhookEnvelope,
  orderId: string,
  economicDisposition: WooCommerceAdjustmentDisposition,
  extra: { reason?: string; replay?: boolean; reversals?: WooCommerceAdjustmentResult["reversals"] } = {},
): WooCommerceAdjustmentResult {
  return Object.freeze({
    sourceEventId: envelope.sourceEventId,
    eventType: envelope.eventType as "order.cancelled" | "refund.created",
    orderId,
    replay: extra.replay ?? economicDisposition === "replay",
    economicDisposition,
    ...(extra.reason ? { reason: extra.reason } : {}),
    reversals: Object.freeze([...(extra.reversals ?? [])]),
  });
}

/**
 * Posts one full reversal per not-yet-reversed earning of the order's
 * processed lines. The reversal id/idempotency key depends only on the
 * original earning, so any number of cancellation/refund deliveries can
 * produce at most one reversal per earning. Nothing is deleted or edited.
 */
function reverseOrderEconomics(input: {
  readonly envelope: WooCommerceWebhookEnvelope;
  readonly orderId: string;
  readonly lines: readonly ProcessedCommerceLineRecord[];
  readonly record: Omit<CommerceAdjustmentRecord, "reversalLedgerEntryIds" | "disposition" | "recordedAt">;
}): WooCommerceAdjustmentResult {
  const ledger = listPersistedLedgerEntries();
  const entitlements = listPersistedPayoutEntitlements();
  const reversedSources = new Set(
    ledger.filter((entry) => entry.entryType === "reversal" && entry.sourceEntryId).map((entry) => entry.sourceEntryId),
  );

  const unreversed: PersistedLedgerEntry[] = [];
  for (const line of input.lines) {
    for (const ledgerEntryId of line.ledgerEntryIds) {
      const earning = ledger.find((entry) => entry.id === ledgerEntryId && entry.entryType === "earning");
      if (earning && !reversedSources.has(earning.id)) unreversed.push(earning);
    }
  }
  if (unreversed.length === 0) return result(input.envelope, input.orderId, "replay");

  const reversedEntitlementIds: string[] = [];
  for (const earning of unreversed) {
    const entitlement = entitlements.find((candidate) => candidate.ledgerEntryId === earning.id);
    if (!entitlement) continue;
    if (entitlement.state === "payable" || entitlement.state === "paid") {
      return result(input.envelope, input.orderId, "manual_review_required", {
        reason: "ENTITLEMENT_ALREADY_PAYABLE_OR_PAID",
      });
    }
    reversedEntitlementIds.push(entitlement.entitlementId);
  }

  const reversals: LedgerEntry[] = unreversed.map((earning) => ({
    id: `reversal:${earning.id}`,
    idempotencyKey: `reversal:${earning.id}`,
    beneficiaryId: earning.beneficiaryId,
    allocationId: earning.allocationId,
    entryType: "reversal",
    amount: money(-BigInt(earning.amountMinor), earning.currency),
    sourceEntryId: earning.id,
    postedAt: input.envelope.receivedAt,
  }));

  commitCommerceAdjustment({
    record: {
      ...input.record,
      disposition: "reversed",
      reversalLedgerEntryIds: reversals.map((entry) => entry.id),
      recordedAt: input.envelope.receivedAt,
    },
    ledgerEntries: reversals,
    reversedEntitlementIds,
  });

  return result(input.envelope, input.orderId, "reversed", {
    reversals: reversals.map((entry) => ({
      ledgerEntryId: entry.id,
      sourceEntryId: entry.sourceEntryId!,
      beneficiaryId: entry.beneficiaryId,
      amountMinor: entry.amount.minor.toString(),
      currency: entry.amount.currency,
    })),
  });
}

export function processWooCommerceCancellation(input: {
  readonly webhook: WooCommerceWebhookEnvelope;
  readonly webhookSecret: string;
}): WooCommerceAdjustmentResult {
  const { webhook } = input;
  const verified = acceptWooCommerceWebhook(webhook, input.webhookSecret);
  const { orderId } = parseWooCommerceCancellationPayload(webhook.rawBody);
  if (verified.replay) return result(webhook, orderId, "replay");

  const lines = linesForOrder(orderId);
  if (lines.length === 0) return result(webhook, orderId, "ignored_no_economics");

  return reverseOrderEconomics({
    envelope: webhook,
    orderId,
    lines,
    record: {
      adjustmentId: `cancellation:${orderId}:${webhook.sourceEventId}`,
      kind: "cancellation",
      orderId,
      sourceEventId: webhook.sourceEventId,
      lineRefunds: [],
    },
  });
}

/**
 * Refund policy:
 *  - Only a refund that, cumulatively, covers the full sale amount of every
 *    processed line is applied (full reversal of all remaining earnings).
 *  - Partial refunds are tracked (for over-refund protection) but never
 *    reverse earnings: how product cost, freight, fulfilment and processing
 *    fees behave on a partial refund is an undefined business rule, so the
 *    event is reported as manual_review_required instead of guessed.
 */
export function processWooCommerceRefund(input: {
  readonly webhook: WooCommerceWebhookEnvelope;
  readonly webhookSecret: string;
}): WooCommerceAdjustmentResult {
  const { webhook } = input;
  const verified = acceptWooCommerceWebhook(webhook, input.webhookSecret);
  const refund = parseWooCommerceRefundPayload(webhook.rawBody);
  const { orderId } = refund;
  if (verified.replay) return result(webhook, orderId, "replay");

  const lines = linesForOrder(orderId);
  if (lines.length === 0) return result(webhook, orderId, "ignored_no_economics");

  const adjustmentId = `refund:${orderId}:${refund.refundId}`;
  if (listCommerceAdjustments().some((record) => record.adjustmentId === adjustmentId)) {
    return result(webhook, orderId, "replay");
  }

  const review = (reason: string) => result(webhook, orderId, "manual_review_required", { reason });

  const lineKeyOf = (lineItemId: string) => `woocommerce:${orderId}:${lineItemId}`;
  const thisRefund = new Map<string, bigint>();
  for (const lineRefund of refund.lineRefunds) {
    if (lineRefund.refundGrossMinor === 0n) continue;
    if (lineRefund.refundGrossMinor < 0n) return review("REFUND_LINE_AMOUNT_INVALID");
    const key = lineKeyOf(lineRefund.lineItemId);
    if (!lines.some((line) => line.lineKey === key)) return review("REFUND_LINE_NOT_PROCESSED");
    thisRefund.set(key, (thisRefund.get(key) ?? 0n) + lineRefund.refundGrossMinor);
  }
  if (thisRefund.size === 0) return review("REFUND_LINES_MISSING");
  if (lines.some((line) => line.saleMerchandiseMinor === undefined)) {
    return review("ORDER_LINE_SALE_AMOUNT_NOT_PERSISTED");
  }

  const priorRefunded = new Map<string, bigint>();
  for (const record of listCommerceAdjustments()) {
    if (record.kind !== "refund" || record.orderId !== orderId) continue;
    for (const lineRefund of record.lineRefunds) {
      priorRefunded.set(lineRefund.lineKey, (priorRefunded.get(lineRefund.lineKey) ?? 0n) + BigInt(lineRefund.refundMinor));
    }
  }

  let full = true;
  for (const line of lines) {
    const cumulative = (priorRefunded.get(line.lineKey) ?? 0n) + (thisRefund.get(line.lineKey) ?? 0n);
    const sale = BigInt(line.saleMerchandiseMinor!);
    if (cumulative > sale) return review("REFUND_EXCEEDS_LINE_SALE");
    if (cumulative !== sale) full = false;
  }

  const record = {
    adjustmentId,
    kind: "refund" as const,
    orderId,
    sourceEventId: webhook.sourceEventId,
    refundId: refund.refundId,
    lineRefunds: [...thisRefund].map(([lineKey, amount]) => ({ lineKey, refundMinor: amount.toString() })),
  };

  if (!full) {
    commitCommerceAdjustment({
      record: {
        ...record,
        disposition: "manual_review_required",
        reason: PARTIAL_REFUND_POLICY_REASON,
        reversalLedgerEntryIds: [],
        recordedAt: webhook.receivedAt,
      },
      ledgerEntries: [],
      reversedEntitlementIds: [],
    });
    return review(PARTIAL_REFUND_POLICY_REASON);
  }

  return reverseOrderEconomics({ envelope: webhook, orderId, lines, record });
}
