# Foundation Baseline v1.0

Status: Certified Baseline
Date: 2026-07-15
Purpose: Record reconciliation state after GRC-0001 canonicalization pass.
Boundary Decision: GD-0004 (Effective 2026-07-15)

## Baseline Summary

The Foundation baseline captures approved governance-complete artifacts and identifies draft artifacts pending governance closure.

Foundation Baseline v1.0 is certified for Foundation-domain scope under GD-0004.

## Foundation Boundary

Foundation defines WHAT Genesis IS.

Compiler Platform defines HOW Genesis BUILDS.

These concerns are architecturally separate and are governed as separate domains.

## Foundation Scope

- Genesis Constitution
- Genesis Architecture Charter (GAC-0001)
- GSP-0001
- GAS-0001
- GES-0001
- FOUNDATION-REGISTRY-v1.0
- FOUNDATION-BASELINE-v1.0
- FOUNDATION-CERTIFICATE-v1.0

## Compiler Platform Scope

- GCS-0001
- GEP-0001
- GSG-0001

These artifacts are Era II Compiler Platform specifications and are intentionally excluded from Foundation Baseline certification.

## Era Transition

Era I concludes with Foundation Baseline v1.0 certification for Foundation-domain artifacts.

Era II proceeds with Compiler Platform lifecycle progression for GCS-0001, GEP-0001, and GSG-0001.

Exclusion rationale: GCS, GEP, and GSG define compiler engineering capability and behavior, which belongs to Compiler Platform scope rather than Foundation identity scope.

Boundary governance note: exclusion from Foundation Baseline certification does not approve or freeze GCS-0001, GEP-0001, or GSG-0001.

### Governance-Complete

- GSP-0001 (GD-0001)
- GAS-0001 (GD-0002)
- GES-0001 (GD-0003)

### Draft / Pending Governance

- GAC-0001 (Draft Charter by design)

## Reconciliation Actions Completed

- Foundation Registry created.
- Engineering package metadata lifecycle fields normalized.
- GSG lifecycle inconsistency corrected (removed non-canonical approval claim).
- Canonical engineering root recommendation documented.
- Repository migration plan documented.
- GCS-0001 GAR-0007A lifecycle normalization actions applied.
- Canonical GCS package path populated under genesis/engineering/packages/GCS-0001.

## Remaining Inconsistencies

- No governance decisions yet for GCS-0001, GSG-0001, GEP-0001 (Compiler Platform scope).
- Engineering roots remain split between docs/engineering and genesis/engineering until migration execution.
- Checksum manifests remain placeholder-based until release-time checksum sealing.

## Compiler Era Gate

Compiler Era readiness requires:

1. Governance decisions for any Compiler Platform artifact moved to Approved status.
2. Canonical engineering root migration completion or formal compatibility policy.
3. Registry refresh after migration execution.

Current gate result: Not yet ready for Compiler Era start.

## Foundation Closure Snapshot

- Governance-complete: GSP-0001, GAS-0001, GES-0001
- Compiler Platform pending governance: GCS-0001, GEP-0001, GSG-0001
- Intentional draft: GAC-0001

Foundation Baseline Certification Scope: Foundation only (GD-0004).

See Era transition roadmap: genesis/foundation/ERA-TRANSITION.md
