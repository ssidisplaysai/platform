import { decideAttribution } from "../attribution";
import { normalizeCommerceOrder } from "../commerce";
import type { EconomicRuleVersion } from "../economic-rule";
import { AppendOnlyLedger } from "../ledger";
import { allocateCommerceLine, type EconomicRuleResolver } from "../allocation-pipeline";

const rules: Record<string, EconomicRuleVersion> = {
  daniel: {
    id: "gym-daniel-direct-v1",
    ruleId: "gym-daniel-direct",
    version: 1,
    effectiveFrom: "2026-10-05T00:00:00Z",
    beneficiaries: [
      { beneficiaryId: "stoner", role: "brand", basisPoints: 5000 },
      { beneficiaryId: "daniel", role: "founding_collaborator", basisPoints: 5000 },
    ],
    residualBeneficiaryId: "stoner",
  },
  creator: {
    id: "gym-creator-v1",
    ruleId: "gym-creator",
    version: 1,
    effectiveFrom: "2026-10-05T00:00:00Z",
    beneficiaries: [
      { beneficiaryId: "stoner", role: "brand", basisPoints: 5000 },
      { beneficiaryId: "jessica", role: "creator", basisPoints: 3500 },
      { beneficiaryId: "daniel", role: "network_override", basisPoints: 1500 },
    ],
    residualBeneficiaryId: "stoner",
  },
  organic: {
    id: "gym-organic-v1",
    ruleId: "gym-organic",
    version: 1,
    effectiveFrom: "2026-10-05T00:00:00Z",
    beneficiaries: [{ beneficiaryId: "stoner", role: "brand", basisPoints: 10000 }],
    residualBeneficiaryId: "stoner",
  },
};

const resolver: EconomicRuleResolver = {
  resolve({ attribution }) {
    if (attribution.selectedPartnerId === "jessica") return rules.creator;
    if (attribution.selectedPartnerId === "daniel") return rules.daniel;
    return rules.organic;
  },
};

function canonicalLine() {
  return normalizeCommerceOrder({
    channel: "stonerusa",
    externalOrderId: "78142",
    organizationId: "stoner",
    currency: "USD",
    convertedAt: "2026-10-05T12:00:00Z",
    lines: [{
      externalLineId: "1",
      productId: "stoner-gym-performance-tee",
      quantity: 1,
      grossMerchandiseMinor: BigInt(6000),
      discountMinor: BigInt(0),
      refundMinor: BigInt(0),
      costs: [
        { kind: "cogs", amountMinor: BigInt(1800) },
        { kind: "inbound_freight_duty", amountMinor: BigInt(100) },
        { kind: "fulfillment_packaging", amountMinor: BigInt(200) },
        { kind: "payment_processing", amountMinor: BigInt(200) },
      ],
    }],
  })[0];
}

describe("Share-to-Grow end-to-end allocation pipeline", () => {
  test("creator sale resolves attribution into 50/35/15 ledger earnings", () => {
    const line = canonicalLine();
    const attribution = decideAttribution({
      conversionAt: line.convertedAt,
      policy: { id: "gym-30d-v1", version: 1, windowDays: 30, effectiveFrom: "2026-10-01T00:00:00Z" },
      touches: [
        { touchId: "daniel-touch", organizationId: "stoner", trackingIdentityId: "qr-daniel", canonicalPartnerId: "daniel", occurredAt: "2026-09-25T12:00:00Z", qualified: true },
        { touchId: "creator-touch", organizationId: "stoner", trackingIdentityId: "qr-jessica", canonicalPartnerId: "jessica", occurredAt: "2026-10-04T12:00:00Z", qualified: true },
      ],
    });
    const ledger = new AppendOnlyLedger();

    const result = allocateCommerceLine({ line, attribution, ruleResolver: resolver, ledger, postedAt: line.convertedAt });

    expect(result.ruleVersionId).toBe("gym-creator-v1");
    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("jessica")).toBe(BigInt(1295));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(555));
    expect(result.ledgerEntries.reduce((sum, e) => sum + e.amount.minor, BigInt(0))).toBe(BigInt(3700));
  });

  test("Daniel direct sale resolves to 50/50", () => {
    const line = canonicalLine();
    const attribution = decideAttribution({
      conversionAt: line.convertedAt,
      policy: { id: "gym-30d-v1", version: 1, windowDays: 30, effectiveFrom: "2026-10-01T00:00:00Z" },
      deterministicSource: { sourceId: "daniel-code", canonicalPartnerId: "daniel", eligible: true },
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({ line, attribution, ruleResolver: resolver, ledger, postedAt: line.convertedAt });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(1850));
  });

  test("organic sale resolves 100 percent to STONER", () => {
    const line = canonicalLine();
    const attribution = decideAttribution({
      conversionAt: line.convertedAt,
      policy: { id: "gym-30d-v1", version: 1, windowDays: 30, effectiveFrom: "2026-10-01T00:00:00Z" },
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({ line, attribution, ruleResolver: resolver, ledger, postedAt: line.convertedAt });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(3700));
  });

  test("reprocessing the same line is ledger-idempotent", () => {
    const line = canonicalLine();
    const attribution = decideAttribution({
      conversionAt: line.convertedAt,
      policy: { id: "gym-30d-v1", version: 1, windowDays: 30, effectiveFrom: "2026-10-01T00:00:00Z" },
      deterministicSource: { sourceId: "daniel-code", canonicalPartnerId: "daniel", eligible: true },
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({ line, attribution, ruleResolver: resolver, ledger, postedAt: line.convertedAt });
    allocateCommerceLine({ line, attribution, ruleResolver: resolver, ledger, postedAt: line.convertedAt });

    expect(ledger.entries()).toHaveLength(2);
    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(1850));
  });
});
