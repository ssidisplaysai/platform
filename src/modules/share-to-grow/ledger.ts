import { Money, negateMoney } from "./money";

export type LedgerEntryType = "earning" | "reversal" | "adjustment";

export interface LedgerEntry {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly beneficiaryId: string;
  readonly allocationId?: string;
  readonly entryType: LedgerEntryType;
  readonly amount: Money;
  readonly sourceEntryId?: string;
  readonly postedAt: string;
}

export class AppendOnlyLedger {
  private readonly entriesById = new Map<string, LedgerEntry>();
  private readonly entryIdByIdempotencyKey = new Map<string, string>();

  post(entry: LedgerEntry): LedgerEntry {
    const existingId = this.entryIdByIdempotencyKey.get(entry.idempotencyKey);
    if (existingId) return this.entriesById.get(existingId)!;
    if (this.entriesById.has(entry.id)) throw new Error("LEDGER_ENTRY_ID_EXISTS");
    if (entry.entryType === "reversal" && !entry.sourceEntryId) {
      throw new Error("REVERSAL_SOURCE_REQUIRED");
    }

    const frozen = Object.freeze({
      ...entry,
      amount: Object.freeze({ ...entry.amount }),
    });
    this.entriesById.set(frozen.id, frozen);
    this.entryIdByIdempotencyKey.set(frozen.idempotencyKey, frozen.id);
    return frozen;
  }

  reverse(
    sourceEntryId: string,
    reversalId: string,
    idempotencyKey: string,
    postedAt: string,
  ): LedgerEntry {
    const source = this.entriesById.get(sourceEntryId);
    if (!source) throw new Error("SOURCE_LEDGER_ENTRY_NOT_FOUND");

    return this.post({
      id: reversalId,
      idempotencyKey,
      beneficiaryId: source.beneficiaryId,
      allocationId: source.allocationId,
      entryType: "reversal",
      amount: negateMoney(source.amount),
      sourceEntryId: source.id,
      postedAt,
    });
  }

  entries(): readonly LedgerEntry[] {
    return Object.freeze([...this.entriesById.values()]);
  }

  balanceMinor(beneficiaryId: string, currency = "USD"): bigint {
    return this.entries()
      .filter(
        (entry) =>
          entry.beneficiaryId === beneficiaryId && entry.amount.currency === currency,
      )
      .reduce((sum, entry) => sum + entry.amount.minor, 0n);
  }
}
