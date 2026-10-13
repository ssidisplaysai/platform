import { decideAttribution } from "../attribution";
import { normalizeCommerceOrder } from "../commerce";
import { AppendOnlyLedger } from "../ledger";
import { allocateCommerceLine } from "../allocation-pipeline";
import {
  createStonerGymRuleResolver,
  STONER_GYM_REFERENCE,
} from "../reference/stoner-gym";

function line() {
  return normalizeCommerceOrder({
    channel: "stonerusa",
    externalOrderId: "gym-reference-order",
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

describe("STONER GYM Share-to-Grow reference configuration", () => {
  test("declares 30-day attribution and clearing policies", () => {
    expect(STONER_GYM_REFERENCE.attributionPolicy.windowDays).toBe(30);
    expect(STONER_GYM_REFERENCE.payoutPolicy.clearingDays).toBe(30);
    expect(STONER_GYM_REFERENCE.foundingCollaboratorPartnerId).toBe("daniel");
  });

  test("recruited creator resolves to 50/35/15 without platform hard-coding", () => {
    const sale = line();
    const attribution = decideAttribution({
      conversionAt: sale.convertedAt,
      policy: STONER_GYM_REFERENCE.attributionPolicy,
      deterministicSource: {
        sourceId: "creator-link",
        canonicalPartnerId: "jessica",
        eligible: true,
      },
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({
      line: sale,
      attribution,
      ruleResolver: createStonerGymRuleResolver({
        recruitedCreatorPartnerIds: ["jessica"],
      }),
      ledger,
      postedAt: sale.convertedAt,
    });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("jessica")).toBe(BigInt(1295));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(555));
  });

  test("Daniel direct resolves to 50/50", () => {
    const sale = line();
    const attribution = decideAttribution({
      conversionAt: sale.convertedAt,
      policy: STONER_GYM_REFERENCE.attributionPolicy,
      deterministicSource: {
        sourceId: "daniel-link",
        canonicalPartnerId: "daniel",
        eligible: true,
      },
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({
      line: sale,
      attribution,
      ruleResolver: createStonerGymRuleResolver({
        recruitedCreatorPartnerIds: ["jessica"],
      }),
      ledger,
      postedAt: sale.convertedAt,
    });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(1850));
    expect(ledger.balanceMinor("daniel")).toBe(BigInt(1850));
  });

  test("unattributed STONER GYM sale resolves 100 percent to STONER", () => {
    const sale = line();
    const attribution = decideAttribution({
      conversionAt: sale.convertedAt,
      policy: STONER_GYM_REFERENCE.attributionPolicy,
      touches: [],
    });
    const ledger = new AppendOnlyLedger();

    allocateCommerceLine({
      line: sale,
      attribution,
      ruleResolver: createStonerGymRuleResolver({
        recruitedCreatorPartnerIds: ["jessica"],
      }),
      ledger,
      postedAt: sale.convertedAt,
    });

    expect(ledger.balanceMinor("stoner")).toBe(BigInt(3700));
    expect(ledger.entries()).toHaveLength(1);
  });
});
