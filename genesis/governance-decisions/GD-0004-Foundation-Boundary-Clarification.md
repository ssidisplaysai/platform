# GD-0004: Foundation Boundary Clarification

Identifier: GD-0004
Title: Foundation Boundary Clarification
Type: Governance Decision Record
Authority: Foundation Authority
Status: Approved
Decision Date: 2026-07-15
Effective Date: 2026-07-15

## 1. Decision Summary

This governance decision records the architectural boundary clarification between the Genesis Foundation and the Genesis Compiler Platform.

Decision intent:
- Foundation defines WHAT Genesis IS.
- Compiler Platform defines HOW Genesis BUILDS.

- GCS-0001, GEP-0001, and GSG-0001 remain Draft Era II artifacts.
- Their exclusion from Foundation certification does not approve or freeze them.

## 2. Motivation

Foundation Baseline v1.0 and Foundation certification require an explicit governance boundary that distinguishes Foundation identity artifacts from Compiler Platform engineering artifacts.

Without this decision, Foundation records risk conflating Foundation completion with Compiler Platform lifecycle completion.

## 3. Rationale

Foundation artifacts define immutable principles, governance, architecture, language, and identity.

Compiler Platform artifacts define engineering behavior and delivery mechanisms for later eras.

Classifying GCS-0001, GEP-0001, and GSG-0001 as Era II Compiler Platform artifacts preserves architectural coherence and prevents premature approval implications.

## 4. Affected Artifacts

Foundation domain:
- Genesis Constitution
- Genesis Architecture Charter (GAC-0001)
- GSP-0001
- GAS-0001
- GES-0001
- FOUNDATION-REGISTRY-v1.0
- FOUNDATION-BASELINE-v1.0
- FOUNDATION-CERTIFICATE-v1.0

Compiler Platform domain (Era II):
- GCS-0001
- GEP-0001
- GSG-0001

## 5. Alternatives Considered

Alternative A: Treat GCS/GEP/GSG as Foundation artifacts.
- Rejected: blurs WHAT vs HOW boundary and introduces certification ambiguity.

Alternative B: Delay boundary clarification until Compiler Era starts.
- Rejected: blocks final Foundation certification and leaves governance scope unresolved.

Alternative C: Approve Compiler Platform artifacts with boundary decision.
- Rejected: violates lifecycle evidence gates and would imply unsupported approvals.

## 6. Compatibility Assessment

This decision is fully compatible with existing identifiers, versions, repository layout, and specification content.

No files are moved, no identifiers are renamed, no versions are changed, and no technical specification content is rewritten.

## 7. Consequences

- Foundation certification proceeds independently of Compiler Platform lifecycle closure.
- Compiler Platform artifacts continue in Draft lifecycle under Era II governance.
- Governance and audit records gain explicit domain separation for future decisions.

## 8. Risks

- Misinterpretation risk: readers may infer Compiler Platform completion from Foundation certification.
	- Mitigation: explicit exclusion language in registry, baseline, certificate, and FOUNDATION.md.

- Transition risk: teams may attempt to start GCC-1001 without Compiler Platform governance readiness.
	- Mitigation: readiness statements remain explicit that GCC-1001 is not yet authorized by this decision.

## 9. Supersession Policy

This decision remains effective until explicitly superseded by a later governance decision.

Any superseding decision SHALL preserve traceability and SHALL NOT retroactively imply Compiler Platform approvals.

## 10. Formal Decision Statement

The Foundation Authority approves GD-0004 and establishes that:

1. Foundation defines WHAT Genesis IS.
2. Compiler Platform defines HOW Genesis BUILDS.
3. GCS-0001, GEP-0001, and GSG-0001 are Compiler Platform Era II artifacts.
4. Foundation certification excludes those Era II artifacts.
5. Exclusion does not approve, freeze, or complete GCS-0001, GEP-0001, or GSG-0001.

## 11. Revision History

- 2026-07-15: Draft created.
- 2026-07-15: Approved with formal boundary clarification structure and certification synchronization directives.

## 12. Classification Clarification

Foundation domain artifacts:
- Genesis Constitution
- Genesis Architecture Charter (GAC-0001)
- GSP-0001
- GAS-0001
- GES-0001
- FOUNDATION-REGISTRY-v1.0
- FOUNDATION-BASELINE-v1.0
- FOUNDATION-CERTIFICATE-v1.0

Compiler Platform domain artifacts (Era II):
- GCS-0001
- GEP-0001
- GSG-0001

## 13. Certification Scope Clarification

Foundation certification excludes Era II Compiler Platform artifacts.

Foundation certification does not imply completion of GCS-0001, GEP-0001, or GSG-0001.

Compiler Platform artifacts continue their lifecycle under Era II governance.

## 4. Repository Constraints Confirmation

- No files moved.
- No identifiers renamed.
- No technical specification content rewritten.
- No versions changed by this clarification decision.

## 5. Traceability

- Foundation registry: genesis/foundation/FOUNDATION-REGISTRY-v1.0.md
- Foundation baseline: genesis/foundation/FOUNDATION-BASELINE-v1.0.md
- Foundation certificate: genesis/foundation/FOUNDATION-CERTIFICATE-v1.0.md
- Era transition roadmap: genesis/foundation/ERA-TRANSITION.md
- Foundation summary: FOUNDATION.md

## 6. Approval Block

Approval: Approved

This decision is effective as of 2026-07-15.