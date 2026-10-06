export type AttributionSourceType = "tracking_identity" | "deterministic_source" | "organic";

export interface AttributionTouch {
  readonly touchId: string;
  readonly organizationId: string;
  readonly trackingIdentityId: string;
  readonly canonicalPartnerId: string;
  readonly occurredAt: string;
  readonly qualified: boolean;
}

export interface DeterministicAttributionSource {
  readonly sourceId: string;
  readonly canonicalPartnerId: string;
  readonly trackingIdentityId?: string;
  readonly eligible: boolean;
}

export interface AttributionPolicyVersion {
  readonly id: string;
  readonly version: number;
  readonly windowDays: number;
  readonly effectiveFrom: string;
}

export interface AttributionDecision {
  readonly policyVersionId: string;
  readonly sourceType: AttributionSourceType;
  readonly selectedPartnerId?: string;
  readonly selectedTrackingIdentityId?: string;
  readonly firstQualifiedTouchId?: string;
  readonly lastQualifiedTouchId?: string;
  readonly decisionReason: string;
}

function asEpoch(iso: string): number {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) throw new Error("INVALID_ATTRIBUTION_TIMESTAMP");
  return epoch;
}

export function decideAttribution(input: {
  conversionAt: string;
  policy: AttributionPolicyVersion;
  deterministicSource?: DeterministicAttributionSource;
  touches: readonly AttributionTouch[];
}): AttributionDecision {
  if (!Number.isInteger(input.policy.windowDays) || input.policy.windowDays < 1) {
    throw new Error("INVALID_ATTRIBUTION_WINDOW");
  }

  const conversionEpoch = asEpoch(input.conversionAt);
  const windowStart =
    conversionEpoch - input.policy.windowDays * 24 * 60 * 60 * 1000;

  const qualified = input.touches
    .filter((touch) => {
      const epoch = asEpoch(touch.occurredAt);
      return touch.qualified && epoch <= conversionEpoch && epoch >= windowStart;
    })
    .sort((a, b) => asEpoch(a.occurredAt) - asEpoch(b.occurredAt));

  const first = qualified[0];
  const last = qualified[qualified.length - 1];

  if (input.deterministicSource?.eligible) {
    return Object.freeze({
      policyVersionId: input.policy.id,
      sourceType: "deterministic_source",
      selectedPartnerId: input.deterministicSource.canonicalPartnerId,
      selectedTrackingIdentityId: input.deterministicSource.trackingIdentityId,
      firstQualifiedTouchId: first?.touchId,
      lastQualifiedTouchId: last?.touchId,
      decisionReason: "eligible_deterministic_source",
    });
  }

  if (last) {
    return Object.freeze({
      policyVersionId: input.policy.id,
      sourceType: "tracking_identity",
      selectedPartnerId: last.canonicalPartnerId,
      selectedTrackingIdentityId: last.trackingIdentityId,
      firstQualifiedTouchId: first.touchId,
      lastQualifiedTouchId: last.touchId,
      decisionReason: "last_qualified_touch_within_window",
    });
  }

  return Object.freeze({
    policyVersionId: input.policy.id,
    sourceType: "organic",
    decisionReason: "no_eligible_source",
  });
}
