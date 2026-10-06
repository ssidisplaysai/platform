import type { LedgerEntry } from "./ledger";

export type PayoutState = "pending" | "cleared" | "payable" | "paid";

export interface PayoutEligibilityPolicy {
  readonly id: string;
  readonly clearingDays: number;
}

export interface PayoutEntitlement {
  readonly entitlementId: string;
  readonly beneficiaryId: string;
  readonly currency: string;
  readonly ledgerEntryId: string;
  readonly amountMinor: bigint;
  readonly state: PayoutState;
  readonly earnedAt: string;
  readonly clearsAt: string;
  readonly statementId?: string;
  readonly paidReference?: string;
}

export interface PayoutStatement {
  readonly statementId: string;
  readonly beneficiaryId: string;
  readonly currency: string;
  readonly entitlementIds: readonly string[];
  readonly totalMinor: bigint;
  readonly state: "payable" | "paid";
  readonly createdAt: string;
  readonly paidAt?: string;
  readonly paidReference?: string;
}

function addDays(iso: string, days: number): string {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) throw new Error("INVALID_PAYOUT_TIMESTAMP");
  return new Date(epoch + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createPendingEntitlement(input: {
  ledgerEntry: LedgerEntry;
  policy: PayoutEligibilityPolicy;
}): PayoutEntitlement {
  if (input.ledgerEntry.entryType !== "earning" && input.ledgerEntry.entryType !== "adjustment") {
    throw new Error("LEDGER_ENTRY_NOT_PAYOUT_ELIGIBLE");
  }
  if (!Number.isInteger(input.policy.clearingDays) || input.policy.clearingDays < 0) {
    throw new Error("INVALID_CLEARING_DAYS");
  }

  return Object.freeze({
    entitlementId: `entitlement:${input.ledgerEntry.id}`,
    beneficiaryId: input.ledgerEntry.beneficiaryId,
    currency: input.ledgerEntry.amount.currency,
    ledgerEntryId: input.ledgerEntry.id,
    amountMinor: input.ledgerEntry.amount.minor,
    state: "pending",
    earnedAt: input.ledgerEntry.postedAt,
    clearsAt: addDays(input.ledgerEntry.postedAt, input.policy.clearingDays),
  });
}

export function advanceToCleared(
  entitlement: PayoutEntitlement,
  asOf: string,
): PayoutEntitlement {
  if (entitlement.state !== "pending") return entitlement;
  if (Date.parse(asOf) < Date.parse(entitlement.clearsAt)) return entitlement;
  return Object.freeze({ ...entitlement, state: "cleared" });
}

export function createPayoutStatement(input: {
  statementId: string;
  beneficiaryId: string;
  currency: string;
  entitlements: readonly PayoutEntitlement[];
  createdAt: string;
}): { statement: PayoutStatement; entitlements: readonly PayoutEntitlement[] } {
  if (input.entitlements.length === 0) throw new Error("PAYOUT_ENTITLEMENTS_REQUIRED");
  if (input.entitlements.some((e) => e.beneficiaryId !== input.beneficiaryId)) {
    throw new Error("PAYOUT_BENEFICIARY_MISMATCH");
  }
  if (input.entitlements.some((e) => e.currency !== input.currency)) {
    throw new Error("PAYOUT_CURRENCY_MISMATCH");
  }
  if (input.entitlements.some((e) => e.state !== "cleared")) {
    throw new Error("PAYOUT_ENTITLEMENT_NOT_CLEARED");
  }

  const entitlementIds = input.entitlements.map((e) => e.entitlementId);
  const totalMinor = input.entitlements.reduce((sum, e) => sum + e.amountMinor, BigInt(0));
  const statement = Object.freeze({
    statementId: input.statementId,
    beneficiaryId: input.beneficiaryId,
    currency: input.currency,
    entitlementIds: Object.freeze(entitlementIds),
    totalMinor,
    state: "payable" as const,
    createdAt: input.createdAt,
  });

  const updated = input.entitlements.map((e) =>
    Object.freeze({ ...e, state: "payable" as const, statementId: input.statementId }),
  );

  return { statement, entitlements: Object.freeze(updated) };
}

export function markStatementPaid(input: {
  statement: PayoutStatement;
  entitlements: readonly PayoutEntitlement[];
  paidAt: string;
  paidReference: string;
}): { statement: PayoutStatement; entitlements: readonly PayoutEntitlement[] } {
  if (input.statement.state !== "payable") throw new Error("STATEMENT_NOT_PAYABLE");
  if (!input.paidReference.trim()) throw new Error("PAID_REFERENCE_REQUIRED");

  const statement = Object.freeze({
    ...input.statement,
    state: "paid" as const,
    paidAt: input.paidAt,
    paidReference: input.paidReference,
  });

  const updated = input.entitlements.map((e) => {
    if (e.statementId !== input.statement.statementId) {
      throw new Error("ENTITLEMENT_STATEMENT_MISMATCH");
    }
    return Object.freeze({
      ...e,
      state: "paid" as const,
      paidReference: input.paidReference,
    });
  });

  return { statement, entitlements: Object.freeze(updated) };
}
