# GACD-0003 Platform Bootstrap API Decision

Decision ID: GACD-0003
Program: Genesis Stabilization Program
Package: GACD-0003
Type: Constitutional Engineering Decision
Status: CERTIFIED
Date: 2026-07-28
Evidence Package: GACI-0002A-R1
Owner: Genesis Architecture and Runtime Authority
Authority: genesis/CONSTITUTION.md
Approval: APPROVED
Supersedes: None
Superseded By: None
Lifecycle: ACTIVE

## 1. Executive Summary
This decision certifies the constitutional architecture for a public Platform Bootstrap API in Genesis.

Purpose:
- Separate protected application layout boundary responsibilities from platform bootstrap responsibilities.
- Preserve runtime authority and dependency direction.
- Establish one approved public platform entry point for platform initialization.

This package is governance-only and introduces no implementation mutation.

## 2. Architectural Problem
GACI-0002A-R1 classified the protected layout seam as MIXED RESPONSIBILITY.

Application-layer behavior currently co-locates:
- Session gate and route protection concerns.
- Platform bootstrap and navigation composition coordination.

This coupling creates application-to-implementation dependency edges and weakens constitutional boundary clarity.

## 3. Constitutional Decision
Genesis SHALL define a certified public Platform Bootstrap API as the only approved public entry point for platform initialization requested by applications.

Applications:
- SHALL request platform bootstrap through the public Platform Bootstrap API.
- SHALL NOT coordinate runtime selection directly.
- SHALL NOT load navigation/bootstrap implementation modules directly.

Platform services:
- SHALL own platform bootstrap coordination and initialization internals behind the public contract.

## 4. Platform Bootstrap Architecture
Canonical dependency interaction:

Application

v

Platform Bootstrap API

v

Platform Services

v

Authoritative Runtime

v

Infrastructure

Prohibited interaction patterns:
- Application -> Runtime Implementation
- Application -> Navigation Implementation
- Application -> Workspace Runtime Selection Implementation

## 5. Public Responsibilities
The Platform Bootstrap API MAY own:
- Platform initialization
- Workspace bootstrap
- Runtime selection
- Navigation model loading
- Module discovery
- Platform capability registration
- Platform initialization state
- Platform startup coordination

The Platform Bootstrap API SHALL NOT own:
- Authentication
- Authorization decisions
- Identity derivation
- Subject creation
- Application routing
- UI composition
- Business workflows

## 6. Application Responsibilities
Protected application layouts after adoption SHALL:
- Authenticate user/session
- Derive identity and subject
- Verify authorization
- Request platform bootstrap from the public API
- Render application shell and UI

Protected application layouts after adoption SHALL NOT:
- Select runtime internals directly
- Load navigation implementation modules directly
- Coordinate module registration internals
- Initialize runtime internals directly

## 7. Runtime Responsibilities
Runtime authority remains governed by GACD-0001.

The Platform Bootstrap API SHALL preserve:
- Single authoritative runtime (src/platform/gop/runtime/orchestration-runtime.ts)
- Runtime authority boundaries
- Non-supersession of authoritative runtime by application code

This decision does not alter runtime authority certification.

## 8. Dependency Direction
This decision reaffirms GACD-0002 dependency policy for this seam:
- Application-to-implementation dependencies are prohibited unless constitutionally certified as bounded exceptions.
- Platform bootstrap orchestration belongs to platform service contracts, not direct application imports.

This decision establishes the constitutional contract direction as:
- Application -> Public Platform Bootstrap API (allowed)
- Application -> Platform bootstrap implementation internals (prohibited)

## 9. Architectural Invariants
The Platform Bootstrap API SHALL preserve:
1. Single Runtime Authority
2. Single Platform Initialization Path
3. Constitutional Dependency Direction
4. Public Platform Contracts
5. Deterministic Bootstrap Behavior
6. Behavior Compatibility during adoption

## 10. Public Contract Definition
This decision defines conceptual contract intent only.

Representative contract operations include:
- initializePlatform()
- loadWorkspace()
- resolveNavigation()
- resolveCapabilities()
- getBootstrapState()

Contract intent:
- Applications consume these operations via public platform contract.
- Contract hides runtime/bootstrap implementation details.
- Contract output is sufficient for protected shell rendering without direct implementation imports.

No implementation signatures are certified by this package.

## 11. Migration Strategy
Planned implementation package:
- GACP-0003 Platform Bootstrap API

Expected implementation scope:
- Introduce public bootstrap contract
- Move runtime-selection logic behind contract
- Move navigation loading behind contract
- Update protected layout to consume public bootstrap contract
- Preserve behavior compatibility
- Remove mixed responsibility from application layer

Scope guard:
- No additional responsibilities beyond certified boundary separation shall be introduced.

## 12. Traceability
- GACD-0001: Runtime Authority Certification Decision
- GACD-0002: Genesis Dependency Policy
- GACI-0002A-R1: Protected Layout Seam Assessment
- GACP-0002A: Application Boundary Convergence package and residual seam evidence

## 13. Decision Metadata
- Decision ID: GACD-0003
- Title: Platform Bootstrap API Decision
- Status: CERTIFIED
- Date: 2026-07-28
- Owner: Genesis Architecture and Runtime Authority
- Authority: genesis/CONSTITUTION.md
- Evidence: GACI-0002A-R1, GACD-0001, GACD-0002, GACP-0002A, GAR-0002 regenerated dependency-direction evidence
- Lifecycle: ACTIVE
- Registry References:
  - genesis/governance/decisions/hall/Hall-of-Decisions.md
  - genesis/governance/machine/governance-registry.json
  - docs/architecture/0001-genesis-architecture.md
  - genesis/constitution/gpm-0001/Genesis-Dependency-Map.md

## Validation Record
- No implementation files modified: VERIFIED
- No runtime behavior changed: VERIFIED
- No dependency metrics changed by this decision package: VERIFIED
- Governance artifacts only updated: VERIFIED
- Registry consistency: VERIFIED
- Cross references validated: VERIFIED
