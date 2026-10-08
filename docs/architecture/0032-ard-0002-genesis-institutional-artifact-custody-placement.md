# ARD-0002: Genesis Institutional Artifact Custody and Placement

**Status:** APPROVED WITH CONDITIONS
**Date:** 2026-08-27
**Authority:** Genesis Architecture Review Board
**Decision Source:** Authorized human Architecture Review Board decision supplied on 2026-08-27
**Source Request:** RAR-0002
**Selected Alternative:** Alternative A - Approve Current Model
**Implementation Status:** NOT PUBLISHED; NOT INTEGRATED; NOT EFFECTIVE ON MAIN

---

## Executive Decision

The Architecture Review Board approves RAR-0002 with conditions and selects Alternative A. Genesis approves the architecture for institutional artifact custody, non-constitutional institutional functions, bounded repository placement, non-authoritative discoverability, and non-constitutional vision-package classification.

This decision was made by an authorized human Architecture Review Board decision-maker. This record formalizes that supplied decision; automation did not make or independently approve it.

Architecture approval does not publish the governance branch, integrate the governance implementation, merge the recovery branch, activate historical lifecycle claims, or authorize GMX work.

## Approved Architecture

Subject to the conditions below, the Board approves:

1. Canonical custody as distinct from canonical authority.
2. Genesis Founder's Office as a non-constitutional founder-intent and historical function.
3. Genesis CEO Office as a non-constitutional executive-intent function.
4. Genesis Experience Studio as a non-constitutional product-experience function.
5. The proposed institutional repository roots, subject to approved integration.
6. Bounded multi-class use of `genesis/philosophy/` without authority arising from placement.
7. `VISION_PACKAGE` as a non-constitutional classification.
8. Deterministic `VISION_PACKAGE` treatment for `GPW-1001`, `GPW-1002`, and `GPW-1003` upon approved integration.
9. `genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` as navigation-only.
10. `genesis/recovery/GRR-20260810/` as provenance-only.
11. Historical lifecycle labels as historical self-description until separately revalidated.
12. Protection of current constitutional GPO identifiers.
13. Separate governance for deferred GMR, GUX, Product Office, and unresolved-reference work.
14. Governance-first, recovery-second integration ordering.
15. `genesis/experience-studio/GMX-0001/` as a proposed future target pending governance integration and separate GMX authorization.

## Approval Conditions

### Condition 1 - Non-Constitutional Institutional Roots

Genesis Founder's Office at `genesis/founder-office/`, Genesis CEO Office at `genesis/ceo-office/`, and Genesis Experience Studio at `genesis/experience-studio/` remain explicitly non-constitutional.

Their existence does not grant constitutional authority, engineering certification, architecture approval, runtime authorization, production authorization, or release authorization.

### Condition 2 - `VISION_PACKAGE` Boundary

`VISION_PACKAGE` is approved as a non-constitutional artifact and package classification. It remains non-implementation-bearing, non-runtime-bearing, non-constitutional, excluded from constitutional package-root parity, incapable of authorizing engineering, and incapable of creating constitutional catalog obligations solely because it physically resides beneath `genesis/engineering/packages/`.

### Condition 3 - GPW Deterministic Classification

The deterministic classification prepared for `GPW-1001`, `GPW-1002`, and `GPW-1003` is approved for activation when the approved governance architecture is integrated.

Each is classified as `VISION_PACKAGE` and receives no engineering, runtime, constitutional, or lifecycle-promotion authority.

### Condition 4 - Institutional Index

`genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` remains:

- `NAVIGATION ONLY`;
- `NON-AUTHORITATIVE`;
- `NON-CONSTITUTIONAL`;
- `NON-LIFECYCLE-BEARING`;
- `NOT A CERTIFICATION REGISTRY`; and
- `NOT A PROMOTION REGISTRY`.

Registration must never independently approve, certify, freeze, publish, canonically promote, or authorize an artifact.

### Condition 5 - Historical Lifecycle Claims

Historical lifecycle labels contained in recovered artifacts remain historical self-descriptions. Repository custody does not independently reactivate them. Current Genesis authority requires applicable independent revalidation.

This applies to `FROZEN`, `CERTIFIED EXPERIENCE STANDARD`, `FOUNDATIONAL BASELINE`, `PORTFOLIO EXPERIENCE BASELINE`, `VISION BASELINE`, `EXECUTIVE BASELINE`, `FOUNDER_WORKING_DRAFT`, `FROZEN PROCESS`, `ARCHIVED`, `MATURING`, `EXPLORING`, and `READY FOR WORKING PAPER`.

### Condition 6 - GPO Identifier Protection

Current constitutional identifiers remain protected:

- `GPO-0001`: Genesis Program Office
- `GPO-0002`: Platform Stabilization

Historical Product Office artifacts may not overwrite, redefine, repurpose, extend by implication, or collide with those identifiers. Any future Product Office institutionalization must use non-conflicting identifiers.

### Condition 7 - Deferred Historical Recovery

GMR recovery, GUX recovery, historical Product Office or GPO recovery, and unresolved-reference repair remain outside this approval. Each requires a separately governed assessment.

### Condition 8 - GMX Placement

The Experience Studio model is architecturally approved. `genesis/experience-studio/GMX-0001/` remains a proposed future target until the approved governance architecture is integrated and effective and a separately authorized GMX remediation task approves and performs relocation.

GMX remains suspended. No GMX movement is authorized by this decision.

### Condition 9 - Governance Before Recovery

The governance architecture must become effective on the integration target before the recovered institutional corpus enters that target. Future ordering is governance first, recovery second.

This approval does not authorize either integration.

### Condition 10 - Custody Is Not Authority

Canonical custody and canonical authority remain distinct.

**Canonical Custody:** The repository is the durable source for preserved artifact bytes, provenance, and history.

**Canonical Authority:** The artifact is currently approved to govern downstream behavior through the applicable Genesis authority process.

Repository presence alone grants custody, not authority.

## Decision and Implementation Status

| Dimension | Status |
|---|---|
| Architecture decision | APPROVED WITH CONDITIONS |
| Selected alternative | Alternative A |
| Governance candidate publication | NOT PUBLISHED |
| Governance integration | NOT INTEGRATED |
| Recovery integration | NOT INTEGRATED |
| Repository implementation on main | NOT EFFECTIVE |
| Documentation review | PENDING |
| Governance Operations review | PENDING |
| Engineering Leadership review | PENDING |
| CODEOWNER review | PENDING |
| GMX | SUSPENDED |

## Constitutional Boundary

This decision establishes no constitutional institution, amends no constitutional artifact, modifies no constitutional catalog or registry, and grants no constitutional, implementation, runtime, production, release, or certification authority.

## Required Follow-Up

1. Record the approved architecture in ADR-0014.
2. Complete Genesis Documentation review.
3. Complete Governance Operations review.
4. Complete Engineering Leadership review.
5. Complete required CODEOWNER review.
6. Return the governance candidate for separate publication authorization.
7. Revalidate current main before any integration.

## Traceability

- Source request: `docs/architecture/RAR-0002-genesis-institutional-artifact-custody-placement.md`
- Governance candidate: `docs/governance/GENESIS_INSTITUTIONAL_ARTIFACT_CUSTODY_AND_PLACEMENT.md`
- Institutional index: `genesis/INSTITUTIONAL-ARTIFACT-INDEX.md`
- Taxonomy: `genesis/engineering/packages/GRN-0002/Package-Catalog-Taxonomy-Standard.md`
- Deterministic GPW classifications: `genesis/engineering/packages/GRN-0002/Catalog-Identifier-Classification-Matrix.md`
- Recovery branch: `origin/recovery/genesis-institutional-corpus-20260810`
- Recovery HEAD: `4815c606897346335b8bdcc2309cfbb588ba933f`

## Final Board Motion Text

"RAR-0002 is approved with conditions. The Architecture Review Board selects Alternative A and approves the institutional artifact custody and placement architecture subject to all ten conditions recorded in ARD-0002. Governance must become effective before recovery integration, and repository custody does not independently grant current authority."