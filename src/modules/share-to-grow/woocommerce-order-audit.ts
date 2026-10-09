import {
  listCommerceAdjustments,
  listEconomicRuleVersions,
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
  listSourceEventReceipts,
} from "./share-to-grow-repository";
import type {
  CommerceAdjustmentRecord,
  PersistedLedgerEntry,
  PersistedPayoutEntitlement,
  ProcessedCommerceLineRecord,
  SourceEventReceiptRecord,
} from "./persistence-types";

const WOOCOMMERCE_LINE_PREFIX = "woocommerce:";

type AuditInput = {
  readonly orderId: number;
  readonly receiptId?: string;
  readonly receipts: readonly SourceEventReceiptRecord[];
  readonly processedLines: readonly ProcessedCommerceLineRecord[];
  readonly ledgerEntries: readonly PersistedLedgerEntry[];
  readonly entitlements: readonly PersistedPayoutEntitlement[];
  readonly rules: ReturnType<typeof listEconomicRuleVersions>;
  readonly adjustments?: readonly CommerceAdjustmentRecord[];
};

type BeneficiaryNet = { beneficiary: string; grossEarning: bigint; reversedAmount: bigint; netEarning: bigint };

function netEconomics(entries: readonly PersistedLedgerEntry[], currency: string) {
  const byBeneficiary = new Map<string, BeneficiaryNet>();
  for (const entry of entries) {
    const row = byBeneficiary.get(entry.beneficiaryId)
      ?? { beneficiary: entry.beneficiaryId, grossEarning: 0n, reversedAmount: 0n, netEarning: 0n };
    const amount = BigInt(entry.amountMinor);
    if (entry.entryType === "earning") row.grossEarning += amount;
    if (entry.entryType === "reversal") row.reversedAmount += -amount;
    row.netEarning = row.grossEarning - row.reversedAmount;
    byBeneficiary.set(entry.beneficiaryId, row);
  }
  const rows = [...byBeneficiary.values()].sort((a, b) => a.beneficiary.localeCompare(b.beneficiary));
  const sum = (pick: (row: BeneficiaryNet) => bigint) => rows.reduce((total, row) => total + pick(row), 0n);
  return {
    originalDmp: moneyFromMinor(sum((row) => row.grossEarning), currency),
    reversedDmp: moneyFromMinor(sum((row) => row.reversedAmount), currency),
    netDmp: moneyFromMinor(sum((row) => row.netEarning), currency),
    beneficiaries: rows.map((row) => ({
      beneficiary: row.beneficiary,
      grossEarning: moneyFromMinor(row.grossEarning, currency),
      reversedAmount: moneyFromMinor(row.reversedAmount, currency),
      netEarning: moneyFromMinor(row.netEarning, currency),
    })),
  };
}

export class WooCommerceAuditReceiptNotFoundError extends Error {
  constructor() {
    super("WOOCOMMERCE_AUDIT_RECEIPT_NOT_FOUND");
    this.name = "WooCommerceAuditReceiptNotFoundError";
  }
}

function moneyFromMinor(minor: bigint, currency: string): { amount: string; currency: string } {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const value = `${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
  return { amount: negative ? `-${value}` : value, currency };
}

function orderLinePrefix(orderId: number): string {
  return `${WOOCOMMERCE_LINE_PREFIX}${orderId}:`;
}

function isCanonicalWooLineForOrder(lineKey: string, orderId: number): boolean {
  const prefix = orderLinePrefix(orderId);
  return lineKey.startsWith(prefix) && lineKey.length > prefix.length;
}

export function buildWooCommerceOrderAudit(input: AuditInput) {
  const processedLines = input.processedLines
    .filter((line) => isCanonicalWooLineForOrder(line.lineKey, input.orderId))
    .sort((left, right) => left.lineKey.localeCompare(right.lineKey));
  const processedRecordCounts = new Map<string, number>();
  for (const line of processedLines) {
    processedRecordCounts.set(line.lineKey, (processedRecordCounts.get(line.lineKey) ?? 0) + 1);
  }
  const lineLedgerIds = new Map<string, Set<string>>();
  for (const line of processedLines) {
    lineLedgerIds.set(line.lineKey, new Set(line.ledgerEntryIds));
  }

  const matchingLedger = input.ledgerEntries
    .filter((entry) => processedLines.some((line) =>
      lineLedgerIds.get(line.lineKey)?.has(entry.id)
      || entry.idempotencyKey.includes(line.lineKey)
      || (entry.sourceEntryId !== undefined && lineLedgerIds.get(line.lineKey)?.has(entry.sourceEntryId))
    ))
    .sort((left, right) => left.id.localeCompare(right.id));
  const matchingLedgerIds = new Set(matchingLedger.map((entry) => entry.id));
  const matchingEntitlements = input.entitlements
    .filter((entitlement) => matchingLedgerIds.has(entitlement.ledgerEntryId))
    .sort((left, right) => left.entitlementId.localeCompare(right.entitlementId));
  const receiptById = new Map(
    input.receipts
      .filter((receipt) => receipt.source === "woocommerce")
      .map((receipt) => [receipt.sourceEventId, receipt]),
  );
  const linkedReceiptIds = new Set(processedLines.map((line) => line.sourceEventId));
  let selectedReceipt: SourceEventReceiptRecord | undefined;
  if (input.receiptId !== undefined) {
    selectedReceipt = receiptById.get(input.receiptId);
    if (!selectedReceipt) throw new WooCommerceAuditReceiptNotFoundError();
  }

  const eventReceipts = [...new Set([
    ...linkedReceiptIds,
    ...(selectedReceipt ? [selectedReceipt.sourceEventId] : []),
  ])]
    .map((receiptId) => receiptById.get(receiptId))
    .filter((receipt): receipt is SourceEventReceiptRecord => receipt !== undefined)
    .sort((left, right) => left.sourceEventId.localeCompare(right.sourceEventId))
    .map((receipt) => ({
      receiptId: receipt.sourceEventId,
      source: receipt.source,
      eventType: receipt.eventType,
      status: "accepted",
      bodyHash: receipt.payloadHash,
      receivedAt: receipt.receivedAt,
      orderAssociation: linkedReceiptIds.has(receipt.sourceEventId)
        ? "linked-to-processed-line"
        : "caller-supplied-order-and-receipt",
    }));

  const processedLineResults = processedLines.map((line) => {
    const ledgerIds = lineLedgerIds.get(line.lineKey) ?? new Set<string>();
    const lineLedger = matchingLedger.filter((entry) =>
      ledgerIds.has(entry.id) || (entry.sourceEntryId !== undefined && ledgerIds.has(entry.sourceEntryId))
    );
    const rule = input.rules.find((candidate) => candidate.id === line.ruleVersionId);
    const allocationLedger = matchingLedger
      .filter((entry) => ledgerIds.has(entry.id))
      .sort((left, right) =>
        (rule?.beneficiaries.findIndex((beneficiary) => beneficiary.beneficiaryId === left.beneficiaryId) ?? Number.MAX_SAFE_INTEGER)
        - (rule?.beneficiaries.findIndex((beneficiary) => beneficiary.beneficiaryId === right.beneficiaryId) ?? Number.MAX_SAFE_INTEGER)
        || left.beneficiaryId.localeCompare(right.beneficiaryId)
      );
    const ledgerComplete = allocationLedger.length === ledgerIds.size && ledgerIds.size > 0;
    const allocationTotalMinor = ledgerComplete
      ? allocationLedger.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n)
      : null;
    const lineItemId = line.lineKey.slice(orderLinePrefix(input.orderId).length);
    return {
      canonicalLineIdentity: line.lineKey,
      orderId: input.orderId,
      lineItemId,
      productId: null,
      attributedPartner: line.attribution.selectedPartnerId ?? null,
      attributedParticipant: line.attribution.selectedPartnerId ?? null,
      trackingIdentityId: line.attribution.selectedTrackingIdentityId ?? null,
      touchId: line.attribution.lastQualifiedTouchId ?? line.attribution.firstQualifiedTouchId ?? null,
      campaignId: null,
      rule: rule ? {
        id: rule.id,
        ruleId: rule.ruleId,
        version: rule.version,
      } : {
        id: line.ruleVersionId,
        ruleId: null,
        version: null,
      },
      dmp: allocationTotalMinor === null
        ? null
        : moneyFromMinor(allocationTotalMinor, allocationLedger[0]?.currency ?? "USD"),
      processingState: ledgerComplete ? "processed" : "incomplete",
      allocations: allocationLedger.map((entry) => {
        const beneficiaryRule = rule?.beneficiaries.find((beneficiary) => beneficiary.beneficiaryId === entry.beneficiaryId);
        return {
          beneficiary: entry.beneficiaryId,
          role: beneficiaryRule?.role ?? null,
          basisPoints: beneficiaryRule?.basisPoints ?? null,
          percentage: beneficiaryRule ? beneficiaryRule.basisPoints / 100 : null,
          ruleId: line.ruleVersionId,
          amount: moneyFromMinor(BigInt(entry.amountMinor), entry.currency),
          allocationId: entry.allocationId ?? null,
          idempotencyKey: entry.idempotencyKey,
        };
      }),
      ledger: lineLedger.map((entry) => ({
        beneficiary: entry.beneficiaryId,
        amount: moneyFromMinor(BigInt(entry.amountMinor), entry.currency),
        type: entry.entryType,
        lifecycle: "posted",
        idempotencyKey: entry.idempotencyKey,
        sourceIdentity: {
          line: line.lineKey,
          event: line.sourceEventId,
        },
      })),
      entitlements: matchingEntitlements
        .filter((entitlement) => ledgerIds.has(entitlement.ledgerEntryId))
        .map((entitlement) => ({
          participant: entitlement.beneficiaryId,
          amount: moneyFromMinor(BigInt(entitlement.amountMinor), entitlement.currency),
          lifecycle: entitlement.state,
          sourceIdentity: {
            ledgerEntryId: entitlement.ledgerEntryId,
            line: line.lineKey,
            event: line.sourceEventId,
          },
        })),
      idempotency: {
        economicEffectCount: processedRecordCounts.get(line.lineKey) ?? 0,
        processedRecordCount: processedRecordCounts.get(line.lineKey) ?? 0,
        allocationCount: allocationLedger.length,
        ledgerEntryCount: lineLedger.length,
        sourceEventIds: [line.sourceEventId],
        reversalEntryCount: lineLedger.filter((entry) => entry.entryType === "reversal").length,
      },
      economics: netEconomics(lineLedger, allocationLedger[0]?.currency ?? "USD"),
    };
  });

  const orderLineKeys = new Set(processedLines.map((line) => line.lineKey));
  const orderAdjustments = (input.adjustments ?? [])
    .filter((adjustment) => String(adjustment.orderId) === String(input.orderId)
      || adjustment.lineRefunds.some((refund) => orderLineKeys.has(refund.lineKey)))
    .sort((a, b) => a.adjustmentId.localeCompare(b.adjustmentId))
    .map((adjustment) => ({
      adjustmentId: adjustment.adjustmentId,
      kind: adjustment.kind,
      sourceEventId: adjustment.sourceEventId,
      refundId: adjustment.refundId ?? null,
      disposition: adjustment.disposition,
      reason: adjustment.reason ?? null,
      reversalLedgerEntryIds: [...adjustment.reversalLedgerEntryIds].sort(),
      recordedAt: adjustment.recordedAt,
    }));

  const hasEconomics = processedLineResults.some((line) =>
    line.allocations.length > 0 || line.ledger.length > 0 || line.entitlements.length > 0
  );
  const selectedReceiptIsSeparateDelivery = Boolean(
    selectedReceipt
      && hasEconomics
      && processedLines.every((line) => line.sourceEventId !== selectedReceipt?.sourceEventId)
      && processedLines.some((line) =>
        receiptById.get(line.sourceEventId)?.payloadHash === selectedReceipt?.payloadHash
        && receiptById.get(line.sourceEventId)?.eventType === selectedReceipt?.eventType
      ),
  );
  const hasUncorrelatedWooReceipts = input.receipts.some((receipt) =>
    receipt.source === "woocommerce" && !linkedReceiptIds.has(receipt.sourceEventId)
  );
  const state = selectedReceiptIsSeparateDelivery
    ? "REPLAY"
    : processedLines.length > 0
      ? "PROCESSED"
      : selectedReceipt
        ? "RECEIPT_ONLY"
        : hasUncorrelatedWooReceipts
          ? "RECEIPT_ASSOCIATION_UNKNOWN"
          : "CLEAN";

  return {
    order: { orderId: input.orderId },
    state,
    eventReceipts,
    processedLines: processedLineResults,
    allocations: processedLineResults.flatMap((line) => line.allocations),
    ledger: processedLineResults.flatMap((line) => line.ledger),
    entitlements: processedLineResults.flatMap((line) => line.entitlements),
    adjustments: orderAdjustments,
    economics: netEconomics(
      matchingLedger,
      matchingLedger[0]?.currency ?? "USD",
    ),
    idempotency: {
      economicEffectsPerCanonicalLine: processedLineResults.map((line) => ({
        canonicalLineIdentity: line.canonicalLineIdentity,
        economicEffectCount: line.idempotency.economicEffectCount,
        allocationCount: line.idempotency.allocationCount,
        ledgerEntryCount: line.idempotency.ledgerEntryCount,
      })),
      receiptReplayEvidence: input.receiptId === undefined
        ? null
        : {
            requestedReceiptId: input.receiptId,
            found: selectedReceipt !== undefined,
            distinctFromProcessedEvent: selectedReceiptIsSeparateDelivery,
            orderAssociation: selectedReceipt && linkedReceiptIds.has(selectedReceipt.sourceEventId)
              ? "linked-to-processed-line"
              : "caller-supplied-order-and-receipt",
            repeatedDeliveryAttemptsPersisted: false,
          },
    },
    evidenceLimitations: {
      productId: "not stored in processed commerce line records",
      campaignId: "not stored in processed commerce line records",
      wooOrderStatus: "not stored in Genesis commerce persistence",
      receiptDiscovery: "source receipt records do not contain order IDs; an unlinked receipt requires receiptId for a caller-supplied order association",
      receiptOrderAssociation: selectedReceipt && !linkedReceiptIds.has(selectedReceipt.sourceEventId)
        ? "receipt record does not store order ID; association is caller-supplied"
        : null,
      dmp: "derived from persisted original allocation ledger entries; raw commerce economics are not stored",
    },
  };
}

export function auditWooCommerceOrder(orderId: number, receiptId?: string) {
  return buildWooCommerceOrderAudit({
    orderId,
    receiptId,
    receipts: listSourceEventReceipts(),
    processedLines: listProcessedCommerceLines(),
    ledgerEntries: listPersistedLedgerEntries(),
    entitlements: listPersistedPayoutEntitlements(),
    rules: listEconomicRuleVersions(),
    adjustments: listCommerceAdjustments(),
  });
}
