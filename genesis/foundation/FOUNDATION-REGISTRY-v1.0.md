# Foundation Registry v1.0

Status: Foundation Closure Registry
Date: 2026-07-15
Scope: Foundation reconciliation registry for Foundation and Compiler Platform artifact classification.

Boundary Clarification: Foundation defines WHAT Genesis IS. Compiler Platform defines HOW Genesis BUILDS.

## Foundation Artifact Matrix

| Identifier | Architectural Domain | Version | Status | Review | Governance | Frozen | Engineering Package | Checksum State | Repository Location | Dependencies |
|---|---|---:|---|---|---|---|---|---|---|---|
| Genesis Constitution | Foundation | 1.0 | Foundational Authority | N/A | N/A | Yes | N/A | N/A | genesis/CONSTITUTION.md | N/A |
| GAC-0001 | Foundation | 1.0 | Draft | Charter draft cycle | N/A | No | N/A | N/A | genesis/charter | Constitution, Foundation |
| GSP-0001 | Foundation | 1.0.0 | Approved | GAR-0001, GAR-0002 | GD-0001 | No | N/A | N/A | genesis/specifications | Constitution, Foundation |
| GAS-0001 | Foundation | 1.0.1 | Approved | GAR-0003, GAR-0004 | GD-0002 | Yes (2026-07-14) | N/A | N/A | genesis/specifications | Constitution, Foundation, GSP-0001 |
| GES-0001 | Foundation | 1.0.1 | Approved | GAR-0005, GAR-0006 | GD-0003 | Yes (2026-07-14) | N/A | N/A | genesis/specifications | Constitution, Foundation, GSP-0001, GAS-0001 |
| FOUNDATION-REGISTRY-v1.0 | Foundation | 1.0 | Active | N/A | N/A | No | N/A | N/A | genesis/foundation | Constitution, Foundation, GSP-0001 |
| FOUNDATION-BASELINE-v1.0 | Foundation | 1.0 | Closure Candidate Baseline | N/A | N/A | No | N/A | N/A | genesis/foundation | Foundation Registry |
| FOUNDATION-CERTIFICATE-v1.0 | Foundation | 1.0 | Conditional Closure Certificate | N/A | N/A | No | N/A | N/A | genesis/foundation | Foundation Baseline, Foundation Registry |
| GCS-0001 | Compiler Platform | 1.0.0 | Draft | GAR-0007 pending submission | Missing | No | genesis/engineering/packages/GCS-0001 (canonical), docs/engineering/packages/GCS-0001 (legacy) | Unsealed - pending final lifecycle approval | genesis/specifications + genesis/engineering/packages | Constitution, Foundation, GSP-0001, GAS-0001, GES-0001 |
| GEP-0001 | Compiler Platform | 1.0.1 | Draft | GAR-0008 completed (required revision disposition) | Missing | No | genesis/engineering/packages/GEP-0001 | Unsealed - pending governance decision | genesis/engineering/packages | Constitution, Foundation, GSP-0001, GAS-0001, GES-0001 |
| GSG-0001 | Compiler Platform | 1.0.1 | Draft | GAR-0010 completed (minor revision disposition) | Missing | No | genesis/engineering/packages/GSG-0001 | Unsealed - pending governance decision | genesis/specifications + genesis/engineering/packages | Constitution, Foundation, GSP-0001, GAS-0001, GES-0001, GEP-0001 |

## Governance Decisions

| Decision | Artifact | Status | Effective Date |
|---|---|---|---|
| GD-0001 | GSP-0001 | Effective | 2026-07-14 |
| GD-0002 | GAS-0001 | Effective | 2026-07-14 |
| GD-0003 | GES-0001 | Effective | 2026-07-14 |
| GD-0004 | Foundation Boundary Clarification | Effective | 2026-07-15 |

## Engineering Packages

| Subject | Canonical Path | Legacy Path | Package Version | Subject Status | Review Status | Governance Linked |
|---|---|---|---:|---|---|---|
| GCS-0001 | genesis/engineering/packages/GCS-0001 | docs/engineering/packages/GCS-0001 | 1.0.0 | Draft | NotReviewed | No |
| GEP-0001 | genesis/engineering/packages/GEP-0001 | N/A | 1.0.1 | Draft | Reviewed | No |
| GSG-0001 | genesis/engineering/packages/GSG-0001 | N/A | 1.0.1 | Draft | Reviewed | No |

## Domain Classification Summary

- Foundation domain artifacts: Genesis Constitution, GAC-0001, GSP-0001, GAS-0001, GES-0001, FOUNDATION-REGISTRY-v1.0, FOUNDATION-BASELINE-v1.0, FOUNDATION-CERTIFICATE-v1.0.
- Compiler Platform domain artifacts: GCS-0001, GEP-0001, GSG-0001.
- Foundation certification scope excludes Compiler Platform artifacts.
- Boundary authority: GD-0004 (Effective 2026-07-15).

## Canonical Engineering Root Recommendation

genesis/engineering is the canonical engineering root.

docs/engineering is retained as legacy-compatible staging until migration completion.
