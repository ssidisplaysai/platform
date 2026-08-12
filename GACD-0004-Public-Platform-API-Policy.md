# GACD-0004 Public Platform API Policy

Decision ID: GACD-0004
Program: Genesis Stabilization Program
Package: GACD-0004
Type: Constitutional Engineering Decision
Status: CERTIFIED
Date: 2026-07-28
Owner: Genesis Architecture and Runtime Authority
Authority: genesis/CONSTITUTION.md
Evidence: GACD-0001, GACD-0002, GACD-0003
Lifecycle: ACTIVE
Approval: APPROVED
Supersedes: None
Superseded By: None

## 1. Executive Summary
This decision establishes permanent constitutional policy for all Public Platform APIs in Genesis.

Public Platform APIs are the only approved mechanism for exposing stable platform capabilities to applications while protecting implementation boundaries, preserving dependency direction, and preserving runtime authority.

This package is governance-only and introduces no implementation.

## 2. Purpose
Public Platform APIs exist to:
- Expose stable platform capabilities.
- Protect implementation boundaries.
- Preserve dependency direction.
- Isolate applications from implementation details.
- Support deterministic evolution.
- Maintain architectural integrity.

## 3. Constitutional Policy
1. Applications SHALL consume only approved Public Platform APIs for platform capabilities.
2. Public Platform APIs SHALL expose capability, never implementation internals.
3. Implementation details SHALL remain internal to platform/runtime/infrastructure ownership domains.
4. Public Platform APIs SHALL preserve Runtime Authority as certified in GACD-0001.
5. Public Platform APIs SHALL preserve Dependency Direction as certified in GACD-0002.
6. Public Platform APIs SHALL remain deterministic in behavior and output semantics.
7. Public Platform APIs SHALL remain backward compatible unless superseded through constitutional lifecycle.

## 4. Public API Principles
Every Public Platform API SHALL define:
- Purpose
- Owner
- Consumers
- Authority
- Lifecycle
- Dependencies
- Public Responsibilities
- Excluded Responsibilities
- Failure Behavior
- Version
- Migration Strategy

## 5. Ownership Model
- Public Platform APIs SHALL be owned by Platform Services.
- Applications SHALL consume Platform APIs.
- Applications SHALL NOT own Platform APIs.
- Runtime SHALL implement platform capabilities but SHALL NOT be exposed directly to applications.

## 6. Application Rules
Applications MAY:
- Request capabilities.
- Request initialization.
- Request platform services.
- Request registries.
- Request identity services.

Applications SHALL NOT:
- Coordinate runtime.
- Load implementation modules.
- Select runtime directly.
- Instantiate infrastructure.
- Perform platform orchestration.

## 7. Platform Rules
Public Platform APIs SHALL NOT expose:
- Runtime internals
- Persistence implementations
- Repository implementations
- Event-store implementations
- Execution-engine internals
- Dependency injection containers
- Private registries
- Compiler internals
- Simulation internals
- Tooling internals
- Internal navigation implementations
- Bootstrap implementations

Platform Services SHALL:
- Expose contract-level capabilities.
- Encapsulate implementation details.
- Preserve deterministic and compatible behavior across lifecycle states.

## 8. Runtime Rules
- Runtime authority remains singular and governed by GACD-0001.
- Public Platform APIs SHALL NOT redefine authoritative runtime ownership.
- Public Platform APIs SHALL consume runtime capabilities through platform ownership boundaries.
- Runtime implementation details SHALL NOT be consumed directly by applications.

## 9. Versioning Policy
Every Public Platform API SHALL declare:
- Version
- Compatibility statement
- Lifecycle state
- Supersession strategy
- Deprecation policy

No breaking public API changes SHALL occur without constitutional approval.

## 10. Lifecycle Policy
Public Platform API lifecycle states:
1. Proposed
2. Certified
3. Implemented
4. Validated
5. Frozen
6. Deprecated
7. Retired

Lifecycle transitions SHALL preserve traceability, compatibility rationale, and successor mapping.

## 11. Engineering Review Rules
Every new Public Platform API SHALL document:
- Purpose
- Authority
- Consumers
- Dependency direction
- Implementation ownership
- Migration strategy
- Public contract
- Traceability

Implementation packages SHALL implement only certified Public Platform APIs.
Implementation packages SHALL NOT invent new public APIs without constitutional certification.

## 12. Architectural Invariants
Every Public Platform API SHALL preserve:
1. Single Runtime Authority
2. Dependency Direction
3. Deterministic Behavior
4. Public Contract Stability
5. Application Independence from implementation internals
6. Platform Independence from application ownership

## 13. Traceability
This policy is derived from and constrained by:
- GACD-0001 Runtime Authority Decision
- GACD-0002 Genesis Dependency Policy
- GACD-0003 Platform Bootstrap API Decision

## 14. Decision Metadata
- Decision ID: GACD-0004
- Title: Public Platform API Policy
- Status: CERTIFIED
- Date: 2026-07-28
- Owner: Genesis Architecture and Runtime Authority
- Authority: genesis/CONSTITUTION.md
- Evidence: GACD-0001, GACD-0002, GACD-0003
- Lifecycle: ACTIVE
- Registry References:
  - genesis/governance/decisions/hall/Hall-of-Decisions.md
  - genesis/governance/machine/governance-registry.json
  - docs/architecture/0001-genesis-architecture.md
  - genesis/governance/standards/Genesis-Standards-Registry.md

## Validation Record
- No implementation files modified: VERIFIED
- No runtime behavior changed: VERIFIED
- No dependency metrics changed: VERIFIED
- Governance artifacts only updated: VERIFIED
- Registry consistency verified: VERIFIED
- Cross-reference validity verified: VERIFIED
