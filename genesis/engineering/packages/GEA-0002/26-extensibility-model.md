# 26 Extensibility Model

## Atlas Compatibility Levels
1. AtlasDiscoverable
2. AtlasMappable
3. AtlasValidated
4. AtlasCertifiable
5. AtlasCertified

## Deterministic Promotion And Downgrade Rules
1. Promotion requires objective gate evidence and rule outcomes; reviewer opinion alone is insufficient.
2. Downgrade occurs automatically when required gate outcomes regress below level requirements.
3. Revocation occurs when constitutional, ownership, certification, or drift-critical failures are detected.
4. Re-entry requires remediation evidence and successful revalidation of failed gates.

## Level 1 AtlasDiscoverable
Entry criteria:
1. Repository or package location resolvable.
2. Canonical identity extractable.
3. Source type admissible by authority model.
4. Minimum manifest or equivalent identity record exists.

Required outputs:
1. Discoverable entity record.
2. Repository location.
3. Source authority tier.
4. Initial diagnostics.

Exit criteria:
1. Identity uniqueness validated.
2. Path resolvable.
3. Source not excluded.
4. Discovery validation passes.

Prohibited claims:
1. Relationship completeness.
2. Ownership completeness.
3. Certification or freeze readiness.

Level requirements:
1. Required metadata: identity and path minimums.
2. Required owner: discovery process owner.
3. Required authority tier: Tier 1-4 admissible, Tier 5 excluded.
4. Required validation: discovery checks pass.
5. Required traceability depth: source artifact/path.
6. Required relationship coverage: not required.
7. Required domain coverage: not required.
8. Allowed query states: NOT_FOUND, UNKNOWN, PARTIAL only.
9. Allowed application consumption: none.

Downgrade and revocation:
1. Path break or excluded source downgrades below discoverable.
2. Identity collision without resolution revokes level.

Re-entry:
1. Fix identity and path issues, rerun discovery gates.

## Level 2 AtlasMappable
Entry criteria:
1. AtlasDiscoverable achieved.
2. Entity type resolved.
3. Minimum relationship metadata available.
4. Package or program context resolvable.

Required outputs:
1. Entity nodes.
2. Relationship candidates.
3. Initial ownership context.
4. Initial traceability context.

Exit criteria:
1. Required entity schema fields satisfied.
2. Mandatory relationships resolved or explicitly UNKNOWN.
3. No fatal identity conflicts.

Prohibited claims:
1. Certification completeness.
2. Freeze readiness.

Level requirements:
1. Required metadata: entity schema minimums.
2. Required owner: mapping authority owner.
3. Required authority tier: authoritative mappings from Tier 1-3 only.
4. Required validation: entity and relationship baseline checks.
5. Required traceability depth: source section where available.
6. Required relationship coverage: minimum mandatory classes with UNKNOWN allowed.
7. Required domain coverage: declared domains plus explicit UNKNOWN for gaps.
8. Allowed query states: COMPLETE, PARTIAL, UNKNOWN, NOT_FOUND.
9. Allowed application consumption: none.

Downgrade and revocation:
1. Fatal identity conflict downgrades to Discoverable.
2. Missing mandatory relationship metadata revokes mappable status.

Re-entry:
1. Resolve schema and relationship minimum failures.

## Level 3 AtlasValidated
Entry criteria:
1. AtlasMappable achieved.
2. Required validation rules available.
3. Ownership and traceability minimums met.
4. Graph integrity checks executable.

Required outputs:
1. Validation results.
2. Diagnostics.
3. Relationship validation state.
4. Ownership validation state.
5. Traceability validation state.

Exit criteria:
1. No FATAL diagnostics.
2. No unresolved blocking ERROR diagnostics.
3. Required validation gates pass.
4. Partial areas explicitly classified.

Prohibited claims:
1. Certification status unless certification criteria met.

Level requirements:
1. Required metadata: validation and diagnostics metadata complete.
2. Required owner: validation authority owner.
3. Required authority tier: validation evidence from admissible tiers.
4. Required validation status: PASS or policy-accepted PARTIAL only.
5. Required traceability depth: package and architecture traceability complete; runtime scope may be NOT APPLICABLE pre-implementation.
6. Required relationship coverage: mandatory classes validated.
7. Required domain coverage: mandatory domains represented or UNKNOWN.
8. Allowed query states: COMPLETE, PARTIAL, UNKNOWN, NOT_FOUND, CONFLICTED.
9. Allowed application consumption: restricted non-authoritative consumption by policy.

Downgrade and revocation:
1. New FATAL or unresolved blocking ERROR downgrades to Mappable.
2. Drift-critical failures revoke validated status.

Re-entry:
1. Remediate blocking diagnostics and rerun full validation.

## Level 4 AtlasCertifiable
Entry criteria:
1. AtlasValidated achieved.
2. Certification authority identified.
3. Certification rules available.
4. Evidence set complete enough for certification review.
5. Output contracts satisfy schema governance requirements.

Required outputs:
1. Certification candidate record.
2. Evidence package.
3. Validation package.
4. Ownership record.
5. Traceability record.
6. Drift assessment.

Exit criteria:
1. Certification review is possible without architectural invention.
2. No blocking stale evidence.
3. No unresolved constitutional or boundary conflict.
4. Certification authority accepts package for review.

Prohibited claims:
1. AtlasCertified.
2. Frozen status.

Level requirements:
1. Required metadata: certification metadata complete.
2. Required owner: certifying authority owner.
3. Required authority tier: authoritative certification evidence from Tier 1-3.
4. Required validation status: certification prerequisite gates PASS.
5. Required traceability depth: claim-level requirements specified and certifiable evidence package complete for available data.
6. Required relationship coverage: no unresolved blocking classes.
7. Required domain coverage: no unresolved blocking domain gaps.
8. Allowed query states: COMPLETE, PARTIAL, UNKNOWN; BLOCKED/CONFLICTED must be non-critical or remediated.
9. Allowed application consumption: policy-scoped and non-authoritative unless certified for that scope.

Downgrade and revocation:
1. Blocking stale evidence downgrades to Validated.
2. Certification authority withdrawal revokes certifiable status.

Re-entry:
1. Restore certifiable evidence package and authority acceptance.

## Level 5 AtlasCertified
Entry criteria:
1. AtlasCertifiable achieved.
2. Authorized certification review completed.
3. Certification decision approved.
4. Required release and governance records created.

Required outputs:
1. Certification record.
2. Release record.
3. Certified output hashes.
4. Certified schema versions.
5. Certified evidence lineage.
6. Drift result.
7. Repository-impact record.

Exit criteria:
1. Certification is valid and current.
2. Required artifacts immutable or governance-controlled.
3. Release state synchronized.
4. Consumers can verify certification.

Prohibited claims:
1. Permanent validity despite later drift.
2. Certification overriding constitutional drift.

Level requirements:
1. Required metadata: full certification and release metadata.
2. Required owner: certification and release governance owners.
3. Required authority tier: certification and release authorities in Tier 1-3.
4. Required validation status: all certification-critical gates PASS.
5. Required traceability depth: generated claim-level provenance complete.
6. Required relationship coverage: mandatory classes complete with governed exceptions only.
7. Required domain coverage: mandatory coverage complete with governed UNKNOWN exceptions only.
8. Allowed query states: COMPLETE and policy-accepted PARTIAL; BLOCKED/CONFLICTED only for explicitly quarantined scopes.
9. Allowed application consumption: authorized according to certification scope.

Downgrade and revocation:
1. Constitutional drift or certification invalidation revokes certified status.
2. Unsynchronized release state downgrades to Certifiable.

Re-entry:
1. Re-certification review required with updated evidence and drift assessment.

## Minimum Future Program Metadata Contract
1. Program identity
2. Package identity
3. Capability ownership
4. Artifact inventory
5. Dependencies
6. Lifecycle
7. Validation
8. Certification
9. Traceability
10. Release state
11. Constitutional authority
12. Application consumption

## Governance Contract
1. Future programs become Atlas-compatible through metadata conformance and governance review.
2. Runtime adapters are not defined here.
3. Contract updates require authority-tier controlled architectural decision records.
