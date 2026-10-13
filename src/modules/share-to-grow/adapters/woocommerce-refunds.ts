import { money } from "../money";
import type { LedgerEntry } from "../ledger";
import { AppendOnlyLedger } from "../ledger";

export interface WooCommerceRefundAllocation {
  readonly sourceEntryId: string;
  readonly refundMinor: bigint;
  readonly originalLineDmpMinor: bigint;
}

export function postProportionalRefund(input: {
  ledger: AppendOnlyLedger;
  sourceEntries: readonly LedgerEntry[];
  refundDmpMinor: bigint;
  originalDmpMinor: bigint;
  refundEventId: string;
  postedAt: string;
}): readonly LedgerEntry[] {
  if (input.originalDmpMinor <= 0n) throw new Error("INVALID_ORIGINAL_DMP");
  if (input.refundDmpMinor <= 0n || input.refundDmpMinor > input.originalDmpMinor) {
    throw new Error("INVALID_REFUND_DMP");
  }

  const earnings = input.sourceEntries.filter((entry) => entry.entryType === "earning");
  const originalTotal = earnings.reduce((sum, entry) => sum + entry.amount.minor, 0n);
  if (originalTotal !== input.originalDmpMinor) {
    throw new Error("REFUND_SOURCE_RECONCILIATION_FAILED");
  }

  let allocated = 0n;
  return Object.freeze(earnings.map((entry, index) => {
    const isLast = index === earnings.length - 1;
    const share = isLast
      ? input.refundDmpMinor - allocated
      : (input.refundDmpMinor * entry.amount.minor) / input.originalDmpMinor;
    allocated += share;

    return input.ledger.post({
      id: `refund:${input.refundEventId}:${entry.id}`,
      idempotencyKey: `refund:${input.refundEventId}:${entry.id}`,
      beneficiaryId: entry.beneficiaryId,
      allocationId: entry.allocationId,
      entryType: "adjustment",
      amount: money(-share, entry.amount.currency),
      sourceEntryId: entry.id,
      postedAt: input.postedAt,
    });
  }));
}
