# 06 Source Authority Model

## Authority Tiers

Tier 1:
1. Genesis Constitution.
2. Certified constitutional decisions.
3. Frozen foundation records.

Tier 2:
1. Certified governance frameworks.
2. Certified architecture standards.
3. Certified capability architecture.
4. Certified enterprise architecture frameworks.

Tier 3:
1. Certified program and package manifests.
2. Certified ownership registries.
3. Certified traceability and validation artifacts.
4. Certified release and certification records.

Tier 4:
1. Approved but unfrozen architecture packages.
2. Proposed package metadata.
3. Explicitly labeled inferred evidence.

Tier 5:
1. Uncertified content.
2. Temporary files.
3. Generated local artifacts.
4. Commentary and logs.
5. Unsupported inference.

## Admissibility
1. Authoritative Atlas data may be created from Tier 1-3 only.
2. Derived Atlas data may be created from Tier 1-4 with explicit derivation rule.
3. Potential data may be created from Tier 4 when unresolved.
4. Tier 5 is excluded from authoritative, derived, and potential generation.

## Conflict Resolution
1. Higher tier overrides lower tier.
2. Newer certified release overrides older certified release in same tier.
3. Superseded evidence remains queryable for lineage but inactive for current-state assertions.
4. Deprecated evidence is retained with lifecycle marker and reduced admissibility.

## Evidence Freshness Status Model
1. CURRENT: valid, active, non-superseded source for current-state assertions.
2. STALE_NON_BLOCKING: source age or recency policy exceeded, but no conflicting current source exists and claim class is non-critical.
3. STALE_BLOCKING: source age or recency policy exceeded for constitutional, ownership, certification, authoritative relationship, or release-state claims.
4. SUPERSEDED: replaced by newer certified source in same evidence lineage.
5. DEPRECATED: still readable for lineage, reduced admissibility by policy.
6. EXPIRED: validity window ended by explicit governance/certification or lifecycle policy.
7. INVALID: parse/signature/schema/certification violation or explicit governance invalidation.

## Freshness Semantics
1. Stale is recency-based and may still be structurally valid.
2. Superseded is replacement-based and independent of recency.
3. Deprecated is policy-based retention with reduced admissibility.
4. Expired is validity-window exhaustion and is not admissible for current-state assertions.
5. Invalid is non-admissible for any authoritative claim.

## Staleness Detection
1. Declared staleness: explicit lifecycle, review, or governance marker in source.
2. Derived staleness: compiler policy computes staleness from release recency, review window, certification freshness, or supersession graph.
3. Inferred staleness: allowed only for warning-level non-authoritative handling when declared and derived signals are absent.

## Admissibility By Freshness Status
1. CURRENT: admissible for authoritative, derived, and potential claims by tier policy.
2. STALE_NON_BLOCKING: admissible for derived and potential claims; authoritative admissibility limited to non-critical claims when no current conflict exists.
3. STALE_BLOCKING: not admissible for authoritative claims; may appear only as potential or unknown support with blocking diagnostics.
4. SUPERSEDED: not admissible for current-state authoritative claims; lineage-visible only.
5. DEPRECATED: admissible for lineage and explicitly downgraded derived claims when policy permits.
6. EXPIRED: excluded from authoritative and derived current-state claims.
7. INVALID: excluded from all claim classes except diagnostic evidence.

## Conflict Precedence With Freshness
1. If CURRENT and any stale status conflict at same tier, CURRENT prevails.
2. If STALE_NON_BLOCKING conflicts with STALE_BLOCKING, STALE_BLOCKING handling prevails and claim is blocked for critical classes.
3. SUPERSEDED, EXPIRED, and INVALID cannot override CURRENT evidence.
4. Equal-tier conflicts between same freshness class require deterministic tiebreaker: certified release order, then canonical source identifier order.

## Fail-Closed Freshness Rules
1. Constitutional authority claims using STALE_BLOCKING, EXPIRED, or INVALID evidence fail closed.
2. Accountable ownership claims using STALE_BLOCKING, EXPIRED, or INVALID evidence fail closed.
3. Certification claims using STALE_NON_BLOCKING for critical certification fields fail closed unless explicitly policy-waived.
4. Authoritative relationship claims using non-CURRENT evidence fail closed unless governance policy explicitly permits STALE_NON_BLOCKING for that relationship class.
5. Release-state assertions using SUPERSEDED, EXPIRED, or INVALID evidence fail closed.

## Freshness Impact On Derived Systems
1. Derived relationships from stale evidence are downgraded to POTENTIAL unless all authoritative prerequisites remain CURRENT.
2. Ownership resolution cannot finalize accountableOwnerId from STALE_BLOCKING, EXPIRED, or INVALID sources.
3. Impact analysis propagates stale class ceilings: no propagated result may be upgraded above its weakest freshness status.
4. Query answerability shall return BLOCKED or CONFLICTED when required critical evidence is STALE_BLOCKING, EXPIRED, or INVALID.

## Diagnostic And Machine-Readable Representation
1. Required fields: evidenceFreshnessStatus, stalenessReason, freshnessEvaluatedAtPolicyVersion, staleBlockingClass.
2. WARNING for STALE_NON_BLOCKING when claim class is non-critical and no conflict exists.
3. ERROR for STALE_NON_BLOCKING when claim class is certification-critical or causes deterministic ambiguity.
4. ERROR or FATAL for STALE_BLOCKING, EXPIRED, and INVALID on critical claims per stage blocking policy.
