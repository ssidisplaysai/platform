import { money } from "../money";
import { allocateByRule, type EconomicRuleVersion } from "../economic-rule";
import { stonerGymEconomicRules } from "../reference/stoner-gym";
import type { LedgerEntry } from "../ledger";
import {
  commitCommerceAdjustment,
  listCommerceAdjustments,
  listEconomicRuleVersions,
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
  | "partially_reversed"
  | "reversed_with_brand_loss"
  | "already_reversed"
  | "replay"
  | "ignored_no_economics"
  | "manual_review_required";

export interface WooCommerceRefundSummary {
  readonly currency: string;
  readonly customerRefundAmount: string;
  readonly economicReversalAmount: string;
  readonly remainingNetDmp: string;
  readonly brandLossAmount: string;
  readonly cumulativeCustomerRefundAmount: string;
  readonly cumulativeEconomicReversalAmount: string;
  readonly cumulativeBrandLossAmount: string;
}

export interface WooCommerceAdjustmentResult {
  readonly sourceEventId: string;
  readonly eventType: "order.cancelled" | "refund.created";
  readonly orderId: string;
  readonly replay: boolean;
  readonly economicDisposition: WooCommerceAdjustmentDisposition;
  readonly reason?: string;
  readonly refund?: WooCommerceRefundSummary;
  readonly reversals: readonly {
    readonly ledgerEntryId: string;
    readonly sourceEntryId: string;
    readonly beneficiaryId: string;
    readonly amountMinor: string;
    readonly currency: string;
  }[];
}

export const REFUND_AFTER_PAYOUT_REASON = "REFUND_AFTER_PAYOUT_THRESHOLD";

function linesForOrder(orderId: string): ProcessedCommerceLineRecord[] {
  const prefix = `woocommerce:${orderId}:`;
  return listProcessedCommerceLines().filter(
    (line) => line.lineKey.startsWith(prefix) && line.lineKey.length > prefix.length,
  );
}

function formatMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function result(
  envelope: WooCommerceWebhookEnvelope,
  orderId: string,
  economicDisposition: WooCommerceAdjustmentDisposition,
  extra: {
    reason?: string;
    replay?: boolean;
    reversals?: WooCommerceAdjustmentResult["reversals"];
    refund?: WooCommerceRefundSummary;
  } = {},
): WooCommerceAdjustmentResult {
  return Object.freeze({
    sourceEventId: envelope.sourceEventId,
    eventType: envelope.eventType as "order.cancelled" | "refund.created",
    orderId,
    replay: extra.replay ?? economicDisposition === "replay",
    economicDisposition,
    ...(extra.reason ? { reason: extra.reason } : {}),
    ...(extra.refund ? { refund: Object.freeze(extra.refund) } : {}),
    reversals: Object.freeze([...(extra.reversals ?? [])]),
  });
}

/** Original locked rule: persisted snapshot, then registered version, then the reference rule with the same id. */
function resolveLockedRule(line: ProcessedCommerceLineRecord): EconomicRuleVersion | undefined {
  if (line.ruleSnapshot) return line.ruleSnapshot;
  const registered = listEconomicRuleVersions().find((candidate) => candidate.id === line.ruleVersionId);
  if (registered) return registered;
  const creatorMatch = /^stoner-gym-creator-(.+)-v1$/.exec(line.ruleVersionId);
  const rules = stonerGymEconomicRules(creatorMatch ? { creatorPartnerId: creatorMatch[1] } : {});
  return [rules.danielDirect, rules.creator, rules.organic].find((rule) => rule.id === line.ruleVersionId);
}

interface LinePlan {
  readonly line: ProcessedCommerceLineRecord;
  readonly originalDmpMinor: bigint;
  readonly priorReversedMinor: bigint;
  readonly reversalMinor: bigint;
  readonly entries: readonly LedgerEntry[];
  readonly currency: string;
}

/**
 * Plans the append-only reversal of one line. The cumulative reversal target is
 * min(cumulative customer refund, original DMP); a full target reverses exactly
 * the remaining per-earning balance. Partial amounts are split with the
 * line's original locked rule, capped by each beneficiary's remaining balance.
 */
function planLineReversal(input: {
  readonly line: ProcessedCommerceLineRecord;
  readonly ledger: readonly PersistedLedgerEntry[];
  readonly adjustmentId: string;
  readonly postedAt: string;
  readonly targetMinor: bigint | "all";
}): LinePlan | { readonly error: string } {
  const { line, ledger } = input;
  const earnings = line.ledgerEntryIds
    .map((id) => ledger.find((entry) => entry.id === id && entry.entryType === "earning"))
    .filter((entry): entry is PersistedLedgerEntry => entry !== undefined);
  const currency = earnings[0]?.currency ?? "USD";
  const reversedBy = new Map<string, bigint>();
  for (const entry of ledger) {
    if (entry.entryType === "reversal" && entry.sourceEntryId) {
      reversedBy.set(entry.sourceEntryId, (reversedBy.get(entry.sourceEntryId) ?? 0n) - BigInt(entry.amountMinor));
    }
  }
  const remaining = new Map(
    earnings.map((earning) => [earning.id, BigInt(earning.amountMinor) - (reversedBy.get(earning.id) ?? 0n)]),
  );
  const original = earnings.reduce((sum, earning) => sum + BigInt(earning.amountMinor), 0n);
  const remainingTotal = [...remaining.values()].reduce((sum, value) => sum + value, 0n);
  const priorReversed = original - remainingTotal;
  const target = input.targetMinor === "all" ? original : input.targetMinor > original ? original : input.targetMinor;
  const delta = target - priorReversed > 0n ? target - priorReversed : 0n;
  const base = { line, originalDmpMinor: original, priorReversedMinor: priorReversed, currency };
  if (delta === 0n) return { ...base, reversalMinor: 0n, entries: [] };

  const amounts = new Map<string, bigint>();
  if (delta === remainingTotal) {
    for (const earning of earnings) amounts.set(earning.id, remaining.get(earning.id) ?? 0n);
  } else {
    const rule = resolveLockedRule(line);
    if (!rule) return { error: "ORIGINAL_RULE_VERSION_NOT_FOUND" };
    const split = allocateByRule(money(delta, currency), rule);
    const byBeneficiary = new Map(earnings.map((earning) => [earning.beneficiaryId, earning]));
    let excess = 0n;
    for (const allocation of split) {
      const earning = byBeneficiary.get(allocation.beneficiaryId);
      if (!earning) {
        if (allocation.amount.minor > 0n) return { error: "ORIGINAL_EARNING_FOR_BENEFICIARY_NOT_FOUND" };
        continue;
      }
      const cap = remaining.get(earning.id) ?? 0n;
      const take = allocation.amount.minor > cap ? cap : allocation.amount.minor;
      excess += allocation.amount.minor - take;
      amounts.set(earning.id, take);
    }
    for (const allocation of split) {
      if (excess === 0n) break;
      const earning = byBeneficiary.get(allocation.beneficiaryId);
      if (!earning) continue;
      const spare = (remaining.get(earning.id) ?? 0n) - (amounts.get(earning.id) ?? 0n);
      const add = spare > excess ? excess : spare;
      if (add > 0n) {
        amounts.set(earning.id, (amounts.get(earning.id) ?? 0n) + add);
        excess -= add;
      }
    }
    if (excess !== 0n) return { error: "REVERSAL_ALLOCATION_RECONCILIATION_FAILED" };
  }

  const entries: LedgerEntry[] = [];
  for (const earning of earnings) {
    const amount = amounts.get(earning.id) ?? 0n;
    if (amount <= 0n) continue;
    const id = `reversal:${earning.id}:${input.adjustmentId}`;
    entries.push({
      id,
      idempotencyKey: id,
      beneficiaryId: earning.beneficiaryId,
      allocationId: earning.allocationId,
      entryType: "reversal",
      amount: money(-amount, earning.currency),
      sourceEntryId: earning.id,
      postedAt: input.postedAt,
    });
  }
  const reversal = entries.reduce((sum, entry) => sum - entry.amount.minor, 0n);
  if (reversal !== delta) return { error: "REVERSAL_ALLOCATION_RECONCILIATION_FAILED" };
  return { ...base, reversalMinor: reversal, entries };
}

function reverseLines(input: {
  readonly envelope: WooCommerceWebhookEnvelope;
  readonly orderId: string;
  readonly lines: readonly ProcessedCommerceLineRecord[];
  readonly kind: "cancellation" | "refund";
  readonly adjustmentId: string;
  readonly payoutReason: string;
  readonly cumulativeRefundByLine: ReadonlyMap<string, bigint>;
  readonly priorRefundByLine: ReadonlyMap<string, bigint>;
  readonly fullByLine: boolean;
  readonly baseRecord: Pick<CommerceAdjustmentRecord, "adjustmentId" | "kind" | "orderId" | "sourceEventId" | "refundId" | "lineRefunds">;
}): WooCommerceAdjustmentResult {
  const ledger = listPersistedLedgerEntries();
  const entitlements = listPersistedPayoutEntitlements();
  const plans: LinePlan[] = [];
  for (const line of input.lines) {
    const cumulative = input.cumulativeRefundByLine.get(line.lineKey) ?? 0n;
    const plan = planLineReversal({
      line,
      ledger,
      adjustmentId: input.adjustmentId,
      postedAt: input.envelope.receivedAt,
      targetMinor: input.kind === "cancellation" || (input.fullByLine && cumulative >= BigInt(line.saleMerchandiseMinor ?? "0"))
        ? "all"
        : cumulative,
    });
    if ("error" in plan) {
      return result(input.envelope, input.orderId, "manual_review_required", { reason: plan.error });
    }
    plans.push(plan);
  }

  const allEntries = plans.flatMap((plan) => plan.entries);
  const reversedEntitlementIds: string[] = [];
  const entitlementReductions: { entitlementId: string; reduceMinor: string }[] = [];
  for (const entry of allEntries) {
    const entitlement = entitlements.find((candidate) => candidate.ledgerEntryId === entry.sourceEntryId);
    if (!entitlement) continue;
    if (entitlement.state === "payable" || entitlement.state === "paid") {
      return result(input.envelope, input.orderId, "manual_review_required", { reason: input.payoutReason });
    }
    const reverse = -entry.amount.minor;
    const earningAmount = BigInt(ledger.find((candidate) => candidate.id === entry.sourceEntryId)!.amountMinor);
    const earlierReversed = [...ledger]
      .filter((candidate) => candidate.entryType === "reversal" && candidate.sourceEntryId === entry.sourceEntryId)
      .reduce((sum, candidate) => sum - BigInt(candidate.amountMinor), 0n);
    if (earningAmount - earlierReversed - reverse === 0n) reversedEntitlementIds.push(entitlement.entitlementId);
    else entitlementReductions.push({ entitlementId: entitlement.entitlementId, reduceMinor: reverse.toString() });
  }

  const currency = plans[0]?.currency ?? "USD";
  const sum = (pick: (plan: LinePlan) => bigint) => plans.reduce((total, plan) => total + pick(plan), 0n);
  const reversalMinor = sum((plan) => plan.reversalMinor);
  const original = sum((plan) => plan.originalDmpMinor);
  const cumulativeReversal = sum((plan) => plan.priorReversedMinor + plan.reversalMinor);
  const lineAdjustments = plans.map((plan) => {
    const cumulativeRefund = input.cumulativeRefundByLine.get(plan.line.lineKey) ?? 0n;
    const priorRefund = input.priorRefundByLine.get(plan.line.lineKey) ?? 0n;
    return {
      lineKey: plan.line.lineKey,
      ruleVersionId: plan.line.ruleVersionId,
      originalDmpMinor: plan.originalDmpMinor.toString(),
      refundMinor: (cumulativeRefund - priorRefund).toString(),
      cumulativeRefundMinor: cumulativeRefund.toString(),
      reversalMinor: plan.reversalMinor.toString(),
      cumulativeReversalMinor: (plan.priorReversedMinor + plan.reversalMinor).toString(),
      remainingDmpMinor: (plan.originalDmpMinor - plan.priorReversedMinor - plan.reversalMinor).toString(),
      cumulativeBrandLossMinor: (cumulativeRefund > plan.originalDmpMinor ? cumulativeRefund - plan.originalDmpMinor : 0n).toString(),
    };
  });
  const brandLossAfter = lineAdjustments.reduce((total, item) => total + BigInt(item.cumulativeBrandLossMinor), 0n);
  const brandLossBefore = plans.reduce((total, plan) => {
    const prior = input.priorRefundByLine.get(plan.line.lineKey) ?? 0n;
    return total + (prior > plan.originalDmpMinor ? prior - plan.originalDmpMinor : 0n);
  }, 0n);
  const brandLossDelta = brandLossAfter - brandLossBefore;
  const remainingNet = original - cumulativeReversal;
  const customerRefund = input.kind === "refund"
    ? lineAdjustments.reduce((total, item) => total + BigInt(item.refundMinor), 0n)
    : 0n;
  const cumulativeRefund = lineAdjustments.reduce((total, item) => total + BigInt(item.cumulativeRefundMinor), 0n);

  const fullyRefunded = input.kind === "refund"
    && input.lines.every((line) => (input.cumulativeRefundByLine.get(line.lineKey) ?? 0n) >= BigInt(line.saleMerchandiseMinor ?? "0"));
  let disposition: WooCommerceAdjustmentDisposition;
  if (reversalMinor === 0n) disposition = "already_reversed";
  else if (remainingNet === 0n) disposition = brandLossDelta > 0n && !fullyRefunded ? "reversed_with_brand_loss" : "reversed";
  else disposition = "partially_reversed";

  if (reversalMinor === 0n && input.kind === "cancellation") {
    return result(input.envelope, input.orderId, "replay");
  }

  const refund: WooCommerceRefundSummary | undefined = input.kind === "refund"
    ? {
        currency,
        customerRefundAmount: formatMinor(customerRefund),
        economicReversalAmount: formatMinor(reversalMinor),
        remainingNetDmp: formatMinor(remainingNet),
        brandLossAmount: formatMinor(brandLossDelta),
        cumulativeCustomerRefundAmount: formatMinor(cumulativeRefund),
        cumulativeEconomicReversalAmount: formatMinor(cumulativeReversal),
        cumulativeBrandLossAmount: formatMinor(brandLossAfter),
      }
    : undefined;

  const recordDisposition: CommerceAdjustmentRecord["disposition"] = disposition === "already_reversed"
    ? "no_economic_effect"
    : disposition === "replay" || disposition === "ignored_no_economics" || disposition === "manual_review_required"
      ? "manual_review_required"
      : disposition;
  commitCommerceAdjustment({
    record: {
      ...input.baseRecord,
      disposition: recordDisposition,
      reversalLedgerEntryIds: allEntries.map((entry) => entry.id),
      recordedAt: input.envelope.receivedAt,
      currency,
      customerRefundMinor: customerRefund.toString(),
      economicReversalMinor: reversalMinor.toString(),
      brandLossMinor: brandLossDelta.toString(),
      remainingNetDmpMinor: remainingNet.toString(),
      lineAdjustments,
    },
    ledgerEntries: allEntries,
    reversedEntitlementIds,
    entitlementReductions,
  });

  return result(input.envelope, input.orderId, disposition, {
    ...(refund ? { refund } : {}),
    reversals: allEntries.map((entry) => ({
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

  const adjustmentId = `cancellation:${orderId}:${webhook.sourceEventId}`;
  return reverseLines({
    envelope: webhook,
    orderId,
    lines,
    kind: "cancellation",
    adjustmentId,
    payoutReason: "ENTITLEMENT_ALREADY_PAYABLE_OR_PAID",
    cumulativeRefundByLine: new Map(),
    priorRefundByLine: new Map(),
    fullByLine: false,
    baseRecord: {
      adjustmentId,
      kind: "cancellation",
      orderId,
      sourceEventId: webhook.sourceEventId,
      lineRefunds: [],
    },
  });
}

/**
 * Refund policy (v1, approved): a customer refund reduces revenue first and
 * incurred costs stay incurred. The cumulative participant reversal per line is
 * min(cumulative customer refund, original DMP), split with the line's original
 * locked rule; participants never go below zero and any excess refund is
 * reported as brand loss (not allocated to collaborators). Taxes, customer
 * shipping and fees are not part of the participant math.
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
  if (thisRefund.size === 0) {
    return result(webhook, orderId, "ignored_no_economics", { reason: "REFUND_HAS_NO_MERCHANDISE_LINES_V1" });
  }
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

  const cumulative = new Map<string, bigint>();
  for (const line of lines) {
    const total = (priorRefunded.get(line.lineKey) ?? 0n) + (thisRefund.get(line.lineKey) ?? 0n);
    if (total > BigInt(line.saleMerchandiseMinor!)) return review("REFUND_EXCEEDS_LINE_SALE");
    cumulative.set(line.lineKey, total);
  }

  return reverseLines({
    envelope: webhook,
    orderId,
    lines,
    kind: "refund",
    adjustmentId,
    payoutReason: REFUND_AFTER_PAYOUT_REASON,
    cumulativeRefundByLine: cumulative,
    priorRefundByLine: priorRefunded,
    fullByLine: true,
    baseRecord: {
      adjustmentId,
      kind: "refund",
      orderId,
      sourceEventId: webhook.sourceEventId,
      refundId: refund.refundId,
      lineRefunds: [...thisRefund].map(([lineKey, amount]) => ({ lineKey, refundMinor: amount.toString() })),
    },
  });
}