import {
  decideAttribution,
  type AttributionPolicyVersion,
} from "../attribution";

const policy: AttributionPolicyVersion = Object.freeze({
  id: "stoner-gym-attribution-v1",
  version: 1,
  windowDays: 30,
  effectiveFrom: "2026-10-05T00:00:00Z",
});

describe("Share-to-Grow attribution", () => {
  test("selects last qualified creator touch inside 30-day window", () => {
    const decision = decideAttribution({
      conversionAt: "2026-10-05T12:00:00Z",
      policy,
      touches: [
        {
          touchId: "touch-daniel",
          organizationId: "stoner",
          trackingIdentityId: "tracking-daniel",
          canonicalPartnerId: "partner-daniel",
          occurredAt: "2026-09-20T12:00:00Z",
          qualified: true,
        },
        {
          touchId: "touch-creator",
          organizationId: "stoner",
          trackingIdentityId: "tracking-creator",
          canonicalPartnerId: "partner-creator",
          occurredAt: "2026-10-04T12:00:00Z",
          qualified: true,
        },
      ],
    });

    expect(decision.selectedPartnerId).toBe("partner-creator");
    expect(decision.firstQualifiedTouchId).toBe("touch-daniel");
    expect(decision.lastQualifiedTouchId).toBe("touch-creator");
    expect(decision.sourceType).toBe("tracking_identity");
  });

  test("eligible deterministic source wins while touch evidence is retained", () => {
    const decision = decideAttribution({
      conversionAt: "2026-10-05T12:00:00Z",
      policy,
      deterministicSource: {
        sourceId: "creator-code-42",
        canonicalPartnerId: "partner-creator",
        eligible: true,
      },
      touches: [
        {
          touchId: "touch-daniel",
          organizationId: "stoner",
          trackingIdentityId: "tracking-daniel",
          canonicalPartnerId: "partner-daniel",
          occurredAt: "2026-10-04T12:00:00Z",
          qualified: true,
        },
      ],
    });

    expect(decision.sourceType).toBe("deterministic_source");
    expect(decision.selectedPartnerId).toBe("partner-creator");
    expect(decision.firstQualifiedTouchId).toBe("touch-daniel");
  });

  test("expired touch does not receive attribution", () => {
    const decision = decideAttribution({
      conversionAt: "2026-10-05T12:00:00Z",
      policy,
      touches: [
        {
          touchId: "old-touch",
          organizationId: "stoner",
          trackingIdentityId: "tracking-daniel",
          canonicalPartnerId: "partner-daniel",
          occurredAt: "2026-08-01T12:00:00Z",
          qualified: true,
        },
      ],
    });

    expect(decision.sourceType).toBe("organic");
    expect(decision.selectedPartnerId).toBeUndefined();
  });

  test("future and unqualified touches are excluded", () => {
    const decision = decideAttribution({
      conversionAt: "2026-10-05T12:00:00Z",
      policy,
      touches: [
        {
          touchId: "future",
          organizationId: "stoner",
          trackingIdentityId: "tracking-future",
          canonicalPartnerId: "partner-future",
          occurredAt: "2026-10-06T12:00:00Z",
          qualified: true,
        },
        {
          touchId: "unqualified",
          organizationId: "stoner",
          trackingIdentityId: "tracking-unqualified",
          canonicalPartnerId: "partner-unqualified",
          occurredAt: "2026-10-04T12:00:00Z",
          qualified: false,
        },
      ],
    });

    expect(decision.sourceType).toBe("organic");
  });

  test("organic conversion is explicit when there is no source", () => {
    const decision = decideAttribution({
      conversionAt: "2026-10-05T12:00:00Z",
      policy,
      touches: [],
    });

    expect(decision).toEqual({
      policyVersionId: "stoner-gym-attribution-v1",
      sourceType: "organic",
      decisionReason: "no_eligible_source",
    });
  });
});
