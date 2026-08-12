# Genesis Implementation Governance

## Implementation Package Initiation
All implementation packages shall:
1. Reference constitutional authority (Constitution, GFR-0001, GGB-0001, GCCS-0001, GAFS-0001).
2. Reference GIA-0001 baseline identifier and planning snapshot hash.
3. Declare workstream ownership, dependencies, and target milestone.
4. Declare architectural boundaries and non-scope constraints.

## Implementation Package Approval
Approval requires:
1. Architectural owner sign-off.
2. Dependency impact review.
3. Constitutional conformance review.
4. Machine artifact and traceability validation.
5. Risk acceptance or mitigation sign-off for non-trivial findings.

## Required Reviews
- Architectural review: required for every package before implementation start.
- Constitutional review: required for every package before approval.
- Security and isolation review: required when runtime/API surfaces are affected.
- Determinism and replay review: required for runtime, automation, and agent execution flows.

## GAR Certification Checkpoints
- GAR checkpoint A: post-foundation implementation package group (Wave 1).
- GAR checkpoint B: post-capability integration package group (Wave 2).
- GAR checkpoint C: pre-production authorization package group (Wave 3).

## Release Process Requirements
1. Release artifacts must bind release tag to immutable commit (`releaseCommit` non-null).
2. Release manifests must include machine-validation status and traceability links.
3. Release approvals require constitutional and architecture confirmation.

## Traceability and Evidence Requirements
Every package must produce:
1. Human-readable implementation record.
2. Machine-readable manifest and status artifacts.
3. Dependency and ownership traceability graph references.
4. Validation evidence and findings classification.
5. GAR eligibility declaration and certification readiness statement.

## Implementation Rules
All implementation packages shall:
- reference governing constitutional authority,
- reference implementation baseline,
- declare dependencies,
- declare architectural ownership,
- produce machine artifacts,
- produce traceability,
- remain GAR-eligible,
- remain certification-eligible.
