import { allocateByRule, EconomicRuleVersion } from "../economic-rule";
import { AppendOnlyLedger } from "../ledger";
import { money } from "../money";

const direct5050: EconomicRuleVersion = Object.freeze({
  id: "rule-version-direct-v1",
  ruleId: "direct",
  version: 1,
  effectiveFrom: "2026-10-05T00:00:00Z",
  residualBeneficiaryId: "stoner",
  beneficiaries: Object.freeze([
    Object.freeze({ beneficiaryId: "stoner", role: "brand", basisPoints: 5000 }),
    Object.freeze({ beneficiaryId: "daniel", role: "founding_collaborator", basisPoints: 5000 }),
  ]),
});

const creatorSplit: EconomicRuleVersion = Object.freeze({
  id: "rule-version-creator-v1",
  ruleId: "creator",
  version: 1,
  effectiveFrom: "2026-10-05T00:00:00Z",
  residualBeneficiaryId: "stoner",
  beneficiaries: Object.freeze([
    Object.freeze({ beneficiaryId: "stoner", role: "brand", basisPoints: 5000 }),
    Object.freeze({ beneficiaryId: "creator-001", role: "creator", basisPoints: 3500 }),
    Object.freeze({ beneficiaryId: "daniel", role: "sponsor", basisPoints: 1500 }),
  ]),
});

describe("Share-to-Grow ledger core", () => {
  test("allocates Daniel direct sale 50/50", () => {
    const result = allocateByRule(money(3700), direct5050);
    expect(result.map((x) => [x.beneficiaryId, x.amount.minor])).toEqual([
      ["stoner", 1850n],
      ["daniel", 1850n],
    ]);
  });

  test("allocates recruited creator sale 50/35/15", () => {
    const result = allocateByRule(money(3700), creatorSplit);
    expect(result.map((x) => [x.beneficiaryId, x.amount.minor])).toEqual([
      ["stoner", 1850n],
      ["creator-001", 1295n],
      ["daniel", 555n],
    ]);
  });

  test("assigns rounding residual deterministically and reconciles exactly", () => {
    const result = allocateByRule(money(1), direct5050);
    expect(result.map((x) => [x.beneficiaryId, x.amount.minor])).toEqual([
      ["stoner", 1n],
      ["daniel", 0n],
    ]);
    expect(result.reduce((sum, x) => sum + x.amount.minor, 0n)).toBe(1n);
  });

  test("reversal is append-only and restores beneficiary balance", () => {
    const ledger = new AppendOnlyLedger();
    ledger.post({
      id: "entry-1",
      idempotencyKey: "order-1:line-1:daniel:v1",
      beneficiaryId: "daniel",
      allocationId: "allocation-1",
      entryType: "earning",
      amount: money(1850),
      postedAt: "2026-10-05T00:00:00Z",
    });
    ledger.reverse("entry-1", "entry-2", "refund-1:daniel", "2026-10-06T00:00:00Z");

    expect(ledger.entries()).toHaveLength(2);
    expect(ledger.balanceMinor("daniel")).toBe(0n);
    expect(ledger.entries()[0].amount.minor).toBe(1850n);
    expect(ledger.entries()[1].amount.minor).toBe(-1850n);
  });

  test("idempotency key prevents duplicate economic effect", () => {
    const ledger = new AppendOnlyLedger();
    const first = ledger.post({
      id: "entry-1",
      idempotencyKey: "order-1:line-1:stoner:v1",
      beneficiaryId: "stoner",
      entryType: "earning",
      amount: money(1850),
      postedAt: "2026-10-05T00:00:00Z",
    });
    const replay = ledger.post({
      id: "entry-replayed",
      idempotencyKey: "order-1:line-1:stoner:v1",
      beneficiaryId: "stoner",
      entryType: "earning",
      amount: money(1850),
      postedAt: "2026-10-05T00:00:01Z",
    });

    expect(replay).toBe(first);
    expect(ledger.entries()).toHaveLength(1);
    expect(ledger.balanceMinor("stoner")).toBe(1850n);
  });
});
