# GACD-0005 Registry Authority Decision

Decision ID: GACD-0005
Program: Genesis Platform Engineering Program
Parent Package: GACI-0003
Package: GACD-0005
Type: Constitutional Engineering Decision
Status: CERTIFIED
Date: 2026-07-28
Owner: Genesis Architecture and Runtime Authority
Authority: genesis/CONSTITUTION.md
Evidence: GAF-0001, GACI-0003, GACD-0001, GACD-0002, GACD-0003, GACD-0004
Lifecycle: ACTIVE
Approval: APPROVED
Supersedes: None
Superseded By: None

## 1. Executive Summary
This package certifies the constitutional Registry Authority Model for Genesis based on completed evidence in GACI-0003.

This decision establishes one constitutional authority, one ownership model, one lifecycle model, and one public exposure classification for every assessed registry.

This package is governance-only and introduces no implementation mutation.

## 2. Constitutional Decision
Genesis certifies the Registry Authority Model under the following constitutional law:
1. Every production registry SHALL have exactly one constitutional authority.
2. Every registry SHALL have exactly one defined ownership model.
3. Every registry SHALL have exactly one defined lifecycle.
4. Every registry SHALL have exactly one public exposure classification.
5. Generated registries SHALL never become authority.
6. Caches SHALL never become authority.
7. Projections SHALL never become authority.
8. Applications SHALL consume only approved Public Platform registry APIs.
9. Applications SHALL never consume runtime registry implementations directly.

## 3. Registry Authority Model

### 3.1 Certified Authority Families
1. Governance Registry Authority
2. Runtime Registry Authority
3. Memory Registry Authority
4. Analytics Registry Authority
5. Compiler Registry Authority
6. Artifact Registry Authority
7. Configuration Registry Authority
8. Generated Evidence Registry Authority

### 3.2 Authority Family Definitions

| Authority Family | Owner | Consumers | Mutation Authority | Persistence Authority | Initialization Authority | Lifecycle | Public API Eligibility |
|---|---|---|---|---|---|---|---|
| Governance Registry Authority | Genesis Governance Authority | Governance maintainers, certification, audit | Governance package maintainers | Git governance artifacts | Governance decision/update workflow | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | No |
| Runtime Registry Authority | Genesis Architecture and Runtime Authority | Platform services, authorized runtime endpoints | Runtime services and authorized runtime APIs | In-memory runtime state only | Runtime bootstrap and orchestrator initialization | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | Indirect only |
| Memory Registry Authority | Genesis Enterprise Agent Authority | GEA memory/context services and approved APIs | Memory service and approved memory APIs | Prisma memory stores and bounded cache | Memory/context bootstrap services | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | Yes |
| Analytics Registry Authority | Genesis Manufacturing Platform Authority | GMP analytics services and approved APIs | Analytics services | Prisma analytics stores | Analytics foundation bootstrap services | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | Indirect only |
| Compiler Registry Authority | Genesis Compiler and Toolchain Authority | Compiler and toolchain subsystems | Compiler runtime/toolchain registration paths | In-memory compiler/toolchain state | Compiler/toolchain bootstrap | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | No |
| Artifact Registry Authority | Genesis Architecture and Runtime Authority | SDK/build artifact workflows | Artifact contract maintainers | N/A for contract placeholders | N/A for contract placeholders | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | No |
| Configuration Registry Authority | Domain platform authorities by service boundary | Runtime and service initializers | Service initialization paths | In-memory configuration state and service persistence where defined | Service bootstrap/config initialization | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | Indirect only |
| Generated Evidence Registry Authority | Genesis Audit Authority | Audit and certification consumers | GAR evidence generation workflows | Generated evidence artifacts | GAR generation workflows | Proposed -> Certified -> Implemented -> Validated -> Frozen -> Deprecated -> Retired | No |

## 4. Registry Classification Policy
Constitutionally recognized primary classes:
- AUTHORITATIVE
- RUNTIME
- CACHE
- CONFIGURATION
- GENERATED
- TRANSITIONAL
- INTERNAL IMPLEMENTATION

Policy:
1. Each registry SHALL have exactly one primary class.
2. AUTHORITATIVE registries SHALL be the only constitutional authority sources for their scope.
3. RUNTIME and CACHE registries SHALL never be constitutional authority sources.
4. GENERATED registries SHALL be evidence/projection artifacts only.
5. TRANSITIONAL registries SHALL carry an explicit convergence disposition.

## 5. Registry Ownership Matrix

| ID | Registry | Primary Class | Constitutional Authority Family | Ownership Authority | Lifecycle | Public Exposure |
|---|---|---|---|---|---|---|
| REG-001 | Governance Registry | AUTHORITATIVE | Governance Registry Authority | Genesis Governance Authority | Active governance lifecycle | Internal Platform Services |
| REG-002 | Baseline Registry | AUTHORITATIVE | Governance Registry Authority | Genesis Governance Baseline Authority | Baseline supersession lifecycle | Internal Platform Services |
| REG-003 | Release Registry | AUTHORITATIVE | Governance Registry Authority | Genesis Governance Release Authority | Governance release lifecycle | Internal Platform Services |
| REG-004 | Registry Update Plan Registry | TRANSITIONAL | Governance Registry Authority | Genesis Governance Decision Authority | Decision transition lifecycle | Internal Platform Services |
| REG-005 | GOP Module Registry | RUNTIME | Runtime Registry Authority | GOP Runtime Authority | Runtime lifecycle | Runtime Internals |
| REG-006 | GOP Workspace Registry | CONFIGURATION | Configuration Registry Authority | GOP Runtime Authority | Runtime configuration lifecycle | Runtime Internals |
| REG-007 | GOP Worker Registry | RUNTIME | Runtime Registry Authority | GOP Runtime Authority | Runtime operational lifecycle | Internal Platform Services |
| REG-008 | GOP Module Loader Cache Registry | CACHE | Runtime Registry Authority | GOP Runtime Authority | Runtime cache lifecycle | Runtime Internals |
| REG-009 | GOP Inspector Extension Registry | INTERNAL IMPLEMENTATION | Runtime Registry Authority | GOP Runtime Authority | Runtime extension lifecycle | Runtime Internals |
| REG-010 | GEA Tool Registry Service | AUTHORITATIVE | Runtime Registry Authority | GEA Tooling Authority | Tool/version lifecycle | Public Platform APIs |
| REG-011 | GEA Tool Runtime Registry | RUNTIME | Runtime Registry Authority | GEA Tooling Authority | Runtime process lifecycle | Runtime Internals |
| REG-012 | GEA Capability Registry | RUNTIME | Runtime Registry Authority | GEA Tooling Authority | Runtime process lifecycle | Runtime Internals |
| REG-013 | GEA Memory Registry Service | AUTHORITATIVE | Memory Registry Authority | GEA Memory Authority | Memory/context lifecycle | Public Platform APIs |
| REG-014 | GEA Context Cache Registry | CACHE | Memory Registry Authority | GEA Memory Authority | Context cache lifecycle | Runtime Internals |
| REG-015 | GMP Analytics Adapter Registry | CONFIGURATION | Configuration Registry Authority | GMP Analytics Authority | Adapter configuration lifecycle | Runtime Internals |
| REG-016 | GMP Attribution Registry | AUTHORITATIVE | Analytics Registry Authority | GMP Analytics Authority | Attribution lifecycle | Internal Platform Services |
| REG-017 | GMP Recommendation Registry | AUTHORITATIVE | Analytics Registry Authority | GMP Analytics Authority | Recommendation lifecycle | Internal Platform Services |
| REG-018 | Compiler Pass Registry (TS) | INTERNAL IMPLEMENTATION | Compiler Registry Authority | Compiler Runtime Authority | Compiler pipeline lifecycle | Runtime Internals |
| REG-019 | Business Genome Pass Registry | INTERNAL IMPLEMENTATION | Compiler Registry Authority | Business Genome Compiler Authority | Compiler pipeline lifecycle | Runtime Internals |
| REG-020 | Discovery Plugin Registry | INTERNAL IMPLEMENTATION | Compiler Registry Authority | Discovery Compiler Authority | Discovery lifecycle | Runtime Internals |
| REG-021 | Toolchain Definition Registry | INTERNAL IMPLEMENTATION | Compiler Registry Authority | Genesis Toolchain Authority | Toolchain lifecycle | Runtime Internals |
| REG-022 | Toolchain Renderer Registry | INTERNAL IMPLEMENTATION | Compiler Registry Authority | Genesis Toolchain Authority | Toolchain lifecycle | Runtime Internals |
| REG-023 | Toolchain Pass Registry (MJS) | TRANSITIONAL | Compiler Registry Authority | Genesis Toolchain Authority | Transitional pipeline lifecycle | Runtime Internals |
| REG-024 | Builder Registry Contract | TRANSITIONAL | Artifact Registry Authority | SDK Architecture Authority | Transitional contract lifecycle | Internal Platform Services |
| REG-025 | Entity Registry Placeholder | TRANSITIONAL | Artifact Registry Authority | Platform Architecture Authority | Transitional placeholder lifecycle | Internal Platform Services |
| REG-026 | Schema Registry Placeholder | TRANSITIONAL | Artifact Registry Authority | Platform Architecture Authority | Transitional placeholder lifecycle | Internal Platform Services |
| REG-027 | GAR Registry Inventory | GENERATED | Generated Evidence Registry Authority | GAR Audit Authority | Audit evidence lifecycle | Generated Evidence |
| REG-028 | GAR Registry Relationship Map | GENERATED | Generated Evidence Registry Authority | GAR Audit Authority | Audit evidence lifecycle | Generated Evidence |

## 6. Public Exposure Policy

Public exposure classifications:
1. Public Platform APIs
2. Internal Platform Services
3. Runtime Internals
4. Generated Evidence

Policy:
1. Applications SHALL consume only approved Public Platform APIs.
2. Applications SHALL NOT import internal registry implementations.
3. Runtime internals SHALL be consumed only through platform-owned boundaries.
4. Generated evidence artifacts SHALL never be consumed as runtime authority.

Approved Public Platform Registry APIs:
- REG-010 GEA Tool Registry Service via approved GEA API contracts.
- REG-013 GEA Memory Registry Service via approved GEA API contracts.

## 7. Duplicate Authority Decisions

| Duplicate Pattern | Classification | Constitutional Disposition |
|---|---|---|
| Persistent tool authority (REG-010) and runtime tool catalog (REG-011) | TRANSITIONAL | Preserve current split until GACP-0004 convergence clarifies runtime cache boundaries; persistent service remains authority. |
| Capability authority fan-out around REG-012 | ARCHITECTURAL DEBT | Consolidate capability ownership into certified authority path in GACP-0004; direct runtime fan-out is not a constitutional authority model. |
| Parallel TS and MJS pass stacks (REG-018, REG-023) | TRANSITIONAL | Maintain compatibility short-term; converge to one compiler authority path under certified migration sequencing. |
| GOP runtime module + loader cache layering (REG-005, REG-008) | APPROVED RUNTIME CACHE | Approved as cache layering only; REG-008 is explicitly non-authoritative and must remain derivative of runtime authority. |
| GAR generated registry projections (REG-027, REG-028) | APPROVED PROJECTION | Approved as generated evidence only; never promote to mutable authority or runtime dependency source. |

## 8. Registry Lifecycle Policy
Certified lifecycle states:
1. Proposed
2. Certified
3. Implemented
4. Validated
5. Frozen
6. Deprecated
7. Retired

Lifecycle governance rules:
1. Authority designation SHALL occur no later than Certified state.
2. Runtime mutation rights SHALL be explicit before Implemented state.
3. Public API eligibility SHALL be explicit by Validated state.
4. Frozen authorities SHALL require successor decision for supersession.
5. Deprecated and Retired transitions SHALL preserve traceability to successor or retirement rationale.

## 9. Architectural Invariants
Registry convergence and evolution SHALL preserve:
1. Single Runtime Authority
2. Single Registry Authority per production registry
3. Dependency Direction
4. Deterministic initialization
5. Deterministic mutation
6. Public API isolation

## 10. Implementation Guidance
Future implementation package: GACP-0004 Registry Convergence.

Certified implementation scope guidance:
1. Eliminate duplicate authority where certified.
2. Convert approved runtime registries into caches where appropriate.
3. Consolidate capability ownership.
4. Preserve runtime behavior.
5. Do not redesign registry architecture beyond this decision.

## 11. Traceability
Constitutional and package lineage:
- GAF-0001
- GACI-0003
- GACD-0001
- GACD-0002
- GACD-0003
- GACD-0004

Registry references:
- genesis/governance/decisions/hall/Hall-of-Decisions.md
- genesis/governance/machine/governance-registry.json
- docs/architecture/0001-genesis-architecture.md
- genesis/governance/standards/Genesis-Standards-Registry.md
- genesis/constitution/gpm-0001/Genesis-Executive-Dashboard.md

## 12. Decision Metadata
- Decision ID: GACD-0005
- Status: CERTIFIED
- Authority: genesis/CONSTITUTION.md
- Owner: Genesis Architecture and Runtime Authority
- Evidence: GAF-0001, GACI-0003, GACD-0001, GACD-0002, GACD-0003, GACD-0004
- Lifecycle: ACTIVE

## Validation Record
- No implementation files modified: VERIFIED
- No runtime behavior changed: VERIFIED
- No registry implementations modified: VERIFIED
- Only governance artifacts updated: VERIFIED
- Registry consistency verified: VERIFIED
- Cross-reference validity verified: VERIFIED
