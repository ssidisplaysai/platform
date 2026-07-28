# 17 Remediation Recommendations

## Remediation Scope Policy
GARR-0001 records findings only. Substantive remediation is deferred to dedicated packages.

## Recommended Minimal Sequence

1. Remediation Package R1: Constitutional Services Registry and Ownership Normalization
- Addresses: FR-001
- Type: Registry correction + governance amendment
- Actions:
  - Register Constitutional Services as first-class manifest family artifacts.
  - Add explicit ownership/authority rows and dependency declarations.
  - Cross-link GBGF/GCDM/GKF interfaces to constitutional-services authorities.

2. Remediation Package R2: Dependency Authority Consolidation
- Addresses: FR-002
- Type: Architecture amendment + decision record package
- Actions:
  - Resolve documented conceptual-loop and dual-surface ambiguity.
  - Publish approved one-directional dependency graph for constitutional pillars.
  - Add explicit prohibited dependency declarations where needed.

3. Remediation Package R3: Lifecycle and Status Taxonomy Normalization
- Addresses: FR-003
- Type: Governance amendment + registry correction
- Actions:
  - Define canonical finite state vocabulary for architecture/implementation/certification/freeze/release.
  - Map legacy status values to canonical taxonomy while preserving historical meaning.
  - Apply additive normalization guidance across ARCHITECTURE_MANIFEST, README, and STATUS.

4. Remediation Package R4: ADR Approval and Decision Authority Closure
- Addresses: FR-004
- Type: Decision record package
- Actions:
  - Complete governance sequence for ADR-0001 through ADR-0004.
  - Publish approval states and effective dates.
  - Update decision index with authoritative status metadata.

## Non-Blocking Editorial Cleanup
- FR-005 may be handled in any remediation package as a non-substantive documentation correction.

## Recommendation
Do not launch independent enterprise constitutional audit until R1 through R4 are closed and revalidated.