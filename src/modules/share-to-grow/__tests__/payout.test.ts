import { AppendOnlyLedger } from "../ledger";
import { money } from "../money";
import {
  advanceToCleared,
  createPendingEntitlement,
  createPayoutStatement,
  markStatementPaid,
} from "../payout";

describe("Share-to-Grow payout accounting", () => {
  test("earning progresses pending to cleared after configured hold", () => {
    const ledger = new AppendOnlyLedger();
    const entry = ledger.post({
      id: "earning-1",
      idempotencyKey: "earning-1",
      beneficiaryId: "daniel",
      entryType: "earning",
      amount: money(1850),
      postedAt: "2026-10-05T00:00:00Z",
    });

    const pending = createPendingEntitlement({
      ledgerEntry: entry,
      policy: { id: "standard-30d", clearingDays: 30 },
    });

    expect(pending.state).toBe("pending");
    expect(advanceToCleared(pending, "2026-10-20T00:00:00Z").state).toBe("pending");
    expect(advanceToCleared(pending, "2026-11-04T00:00:00Z").state).toBe("cleared");
  });

  test("cleared entitlements become a payable statement and reconcile exactly", () => {
    const ledger = new AppendOnlyLedger();
    const first = ledger.post({
      id: "earning-1",
      idempotencyKey: "earning-1",
      beneficiaryId: "daniel",
      entryType: "earning",
      amount: money(1850),
      postedAt: "2026-10-01T00:00:00Z",
    });
    const second = ledger.post({
      id: "earning-2",
      idempotencyKey: "earning-2",
      beneficiaryId: "daniel",
      entryType: "earning",
      amount: money(555),
      postedAt: "2026-10-02T00:00:00Z",
    });

    const entitlements = [first, second].map((entry) =>
      advanceToCleared(
        createPendingEntitlement({ ledgerEntry: entry, policy: { id: "standard-0d", clearingDays: 0 } }),
        "2026-10-05T00:00:00Z",
      ),
    );

    const result = createPayoutStatement({
      statementId: "stmt-daniel-2026-10",
      beneficiaryId: "daniel",
      currency: "USD",
      entitlements,
      createdAt: "2026-10-05T00:00:00Z",
    });

    expect(result.statement.totalMinor).toBe(BigInt(2405));
    expect(result.statement.state).toBe("payable");
    expect(result.entitlements.every((e) => e.state === "payable")).toBe(true);
  });

  test("paid state requires an external payment reference but does not move money", () => {
    const ledger = new AppendOnlyLedger();
    const entry = ledger.post({
      id: "earning-1",
      idempotencyKey: "earning-1",
      beneficiaryId: "creator-1",
      entryType: "earning",
      amount: money(1295),
      postedAt: "2026-10-01T00:00:00Z",
    });

    const cleared = advanceToCleared(
      createPendingEntitlement({ ledgerEntry: entry, policy: { id: "standard-0d", clearingDays: 0 } }),
      "2026-10-02T00:00:00Z",
    );
    const payable = createPayoutStatement({
      statementId: "stmt-creator-1",
      beneficiaryId: "creator-1",
      currency: "USD",
      entitlements: [cleared],
      createdAt: "2026-10-02T00:00:00Z",
    });

    const paid = markStatementPaid({
      statement: payable.statement,
      entitlements: payable.entitlements,
      paidAt: "2026-10-03T00:00:00Z",
      paidReference: "manual-ach-reference-001",
    });

    expect(paid.statement.state).toBe("paid");
    expect(paid.statement.paidReference).toBe("manual-ach-reference-001");
    expect(paid.entitlements[0].state).toBe("paid");
  });

  test("mixed beneficiary statements are rejected", () => {
    expect(() => createPayoutStatement({
      statementId: "bad",
      beneficiaryId: "daniel",
      currency: "USD",
      createdAt: "2026-10-05T00:00:00Z",
      entitlements: [
        {
          entitlementId: "e1",
          beneficiaryId: "daniel",
          currency: "USD",
          ledgerEntryId: "l1",
          amountMinor: BigInt(100),
          state: "cleared",
          earnedAt: "2026-10-01T00:00:00Z",
          clearsAt: "2026-10-01T00:00:00Z",
        },
        {
          entitlementId: "e2",
          beneficiaryId: "creator",
          currency: "USD",
          ledgerEntryId: "l2",
          amountMinor: BigInt(100),
          state: "cleared",
          earnedAt: "2026-10-01T00:00:00Z",
          clearsAt: "2026-10-01T00:00:00Z",
        },
      ],
    })).toThrow("PAYOUT_BENEFICIARY_MISMATCH");
  });
});
