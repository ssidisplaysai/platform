# GACD-0006 Kernel Authority Decision

Decision ID: GACD-0006
Program: Genesis Platform Engineering Program
Parent Assessment: GACI-0004
Package: GACD-0006
Type: Constitutional Architecture Authority
Status: CERTIFIED
Date: 2026-07-29
Owner: Genesis Architecture and Runtime Authority
Authority: genesis/CONSTITUTION.md
Evidence: GAF-0001, GACI-0004, GACD-0001, GACD-0002, GACD-0003, GACD-0004, GACD-0005, GACP-0002A, GACP-0003, GACP-0004
Lifecycle: ACTIVE
Approval: APPROVED
Supersedes: None
Superseded By: None
Current Implementation State: TRANSITIONAL HYBRID
Target Implementation State: MINIMAL ORCHESTRATION ROOT

## 1. Executive Summary
This decision certifies the constitutional Kernel Authority Model for Genesis based on GACI-0004.

Genesis is certified as a Transitional Hybrid architecture with a thin active orchestration root in GOP and bounded authority services for runtime-adjacent and domain responsibilities.

This package establishes permanent constitutional limits for kernel authority, confirms GOP as the orchestration root, and prevents kernel ownership expansion into bounded authorities.

This package is governance-only and introduces no implementation mutation.

## 2. Constitutional Decision
Genesis SHALL use a Minimal Orchestration Root model.

Constitutional declarations:
1. GOP SHALL remain the constitutional orchestration root.
2. The term kernel SHALL refer only to the minimal orchestration boundary certified by this decision.
3. The orchestration root SHALL coordinate bounded authorities and SHALL NOT absorb their ownership responsibilities.
4. Legacy core kernel placeholders SHALL NOT be treated as production authority.
5. Coordination authority and ownership authority SHALL remain constitutionally distinct.

## 3. Current Architectural State
Certified current implementation model: TRANSITIONAL HYBRID.

Evidence summary from GACI-0004:
- Legacy core kernel files are empty placeholders with no production imports.
- Active kernel-like coordination is concentrated in GOP orchestration, bootstrap wiring, queue/worker/scheduling coordination, and runtime service access paths.
- Bounded authorities already own most domain, registry, and specialized runtime responsibilities.
- GEA, GBA, GMP, Business Genome, Marketing, Governance, Compiler, GAR tooling, authentication, and authorization remain outside kernel ownership.

## 4. Target Kernel Model
Certified target model: MINIMAL ORCHESTRATION ROOT.

Target model intent:
- Keep one thin orchestration root.
- Keep one owner per bounded responsibility.
- Keep authority-service ownership outside kernel boundaries.
- Converge transitional artifacts without creating a new kernel framework.

## 5. Minimal Orchestration Root Responsibilities
The orchestration root MAY own only these categories:
1. Platform execution coordination.
2. Orchestration lifecycle coordination.
3. Command and workflow routing.
4. Coordination of bounded runtime services.
5. Startup sequencing where not owned by Bootstrap Authority.
6. Shutdown sequencing.
7. Cross-authority execution coordination.
8. Orchestration-level health aggregation.
9. Deterministic execution handoff.

The orchestration root MAY coordinate, route, sequence, invoke, aggregate, observe, and enforce orchestration contracts.

## 6. Bounded Authority Responsibilities
The following responsibilities are constitutionally delegated and SHALL remain authority-owned outside kernel ownership:
1. Runtime execution mechanics.
2. Platform bootstrap ownership.
3. Queue ownership.
4. Worker ownership.
5. Scheduling ownership.
6. Messaging ownership.
7. Registry ownership.
8. Persistence ownership.
9. Identity ownership.
10. Configuration ownership.
11. Business Genome authority.
12. Domain logic ownership.
13. Application authentication.
14. Application authorization.
15. Compiler execution authority.
16. Governance authority.
17. Generated evidence authority.

## 7. Ownership and Coordination Matrix
| Responsibility Class | Authority Owner | Kernel Relationship | Mutation Authority | Lifecycle Authority | Public Exposure |
|---|---|---|---|---|---|
| Orchestration root coordination | GOP Orchestration Authority | Owns minimal root coordination only | Limited to orchestration coordination state | Orchestration lifecycle | Internal unless certified via public platform API |
| Platform bootstrap | Platform Bootstrap Authority | Coordinated by root, not owned by root | Bootstrap authority only | Bootstrap lifecycle | Public Platform API seam |
| Runtime mechanics | Runtime Authority | Coordinated by root, not superseded | Runtime authority only | Runtime lifecycle | Internal runtime boundaries |
| Queue state and queue lifecycle | Queue Authority | Coordinated by root, not owned by root | Queue authority only | Queue lifecycle | Internal runtime/services |
| Worker lifecycle | Worker Authority | Coordinated by root, not owned by root | Worker authority only | Worker lifecycle | Internal runtime/services |
| Schedule evaluation and triggers | Scheduling Authority | Coordinated by root, not owned by root | Scheduling authority only | Scheduling lifecycle | Internal runtime/services |
| Messaging transport/delivery | Messaging Authority | Coordinated by root, not owned by root | Messaging authority only | Messaging lifecycle | Internal runtime/services |
| Registry ownership | Registry Authority (GACD-0005) | Consumed by contract only | Registry authority only | Registry lifecycle | Public exposure per registry policy |
| Domain services (GEA/GBA/GMP/Marketing) | Domain Service Authorities | Invoked by contracts only | Domain authority only | Domain lifecycle | Approved service and public APIs |
| Governance/Compiler/GAR and evidence | Governance/Compiler/Audit authorities | Outside kernel ownership | Authority-specific only | Authority-specific lifecycle | Governance and tooling boundaries |

## 8. Bootstrap Boundary
Platform Bootstrap Authority SHALL own:
- Platform initialization entry.
- Runtime selection.
- Platform service initialization.
- Public application-facing bootstrap seam.

The orchestration root SHALL NOT replace or bypass the Platform Bootstrap API.

Startup sequencing SHALL be explicitly classified between Bootstrap Authority and Orchestration Authority.

## 9. Runtime Boundary
Runtime Authority remains governed by GACD-0001.

Kernel boundary policy:
1. The orchestration root SHALL coordinate runtime execution.
2. The orchestration root SHALL NOT become a second runtime authority.
3. Runtime implementation selection SHALL remain outside kernel ownership unless explicitly delegated through certified bootstrap contracts.

## 10. Queue, Worker, Scheduling, and Messaging Boundaries
Boundary law:
1. Queue Authority SHALL own queued-work state and queue lifecycle.
2. Worker Authority SHALL own work-processing lifecycle.
3. Scheduling Authority SHALL own schedule evaluation and trigger lifecycle.
4. Messaging Authority SHALL own transport and delivery lifecycle.
5. The orchestration root MAY coordinate these authorities but SHALL NOT duplicate their state or mutation paths.

## 11. Registry Boundary
Registry Authority remains governed by GACD-0005.

Kernel registry policy:
1. The orchestration root MAY consume approved registry contracts.
2. The orchestration root SHALL NOT become registry authority.
3. The orchestration root SHALL NOT maintain an independent authoritative registry.
4. The orchestration root SHALL NOT mutate generated registry evidence.
5. Caches and projections SHALL NOT be treated as authority.

## 12. Domain Exclusion Policy
The following responsibilities SHALL remain outside kernel authority:
- GEA domain responsibilities
- GBA domain responsibilities
- GMP domain responsibilities
- Business Genome authority
- Marketing authority
- Governance authority
- Compiler authority
- GAR tooling
- Application authentication
- Application authorization
- Application presentation
- Application navigation
- Domain-specific analytics
- Domain-specific persistence

Kernel prohibition policy:
1. The orchestration root SHALL NOT own domain data.
2. The orchestration root SHALL NOT own application state.
3. The orchestration root SHALL NOT own authentication or authorization.
4. The orchestration root SHALL NOT own Business Genome, compiler, analytics, or marketing logic.
5. The orchestration root SHALL NOT become a general service locator.

## 13. Legacy Placeholder Disposition
Legacy core kernel placeholders are constitutionally classified as TRANSITIONAL ARCHITECTURE ARTIFACTS.

Disposition policy:
1. They SHALL carry no production authority.
2. They SHALL NOT receive new responsibilities.
3. They SHALL NOT be treated as future extension points.
4. They SHALL be marked for controlled deprecation or removal.
5. They SHALL remain unchanged until an approved implementation package addresses them.

Future deprecation/removal preconditions:
- No production imports.
- No public API dependency.
- No generated artifact dependency.
- No test-only contractual dependency.
- No documentation dependency requiring migration.

## 14. Public Platform Exposure Policy
Applications SHALL consume only approved public platform contracts.

Approved consumption boundary:
- Platform Bootstrap API
- Approved application services
- Approved public platform contracts

Applications SHALL NOT consume:
- Orchestration internals
- Worker internals
- Queue internals
- Runtime implementation internals
- Kernel placeholder modules
- Internal authority constructors

The orchestration root SHALL NOT be exposed directly to applications except through approved public platform APIs.

## 15. Kernel Lifecycle
Certified kernel authority lifecycle:
1. ASSESSED
2. CERTIFIED
3. IMPLEMENTED
4. VALIDATED
5. FROZEN
6. DEPRECATED
7. RETIRED

State after this decision:
- Kernel Authority Model: CERTIFIED
- Current implementation model: TRANSITIONAL HYBRID
- Target implementation model: MINIMAL ORCHESTRATION ROOT

## 16. Architectural Invariants
Binding invariants:
1. One orchestration root.
2. One authority owner per bounded responsibility.
3. Coordination does not imply ownership.
4. Runtime authority remains singular.
5. Registry authority remains singular per registry.
6. Bootstrap remains the public initialization authority.
7. Domain logic remains outside kernel ownership.
8. Kernel internals are not public platform APIs.
9. Generated evidence never becomes authority.
10. Legacy placeholders never acquire new authority.
11. Dependency direction SHALL remain valid.
12. Kernel convergence SHALL reduce responsibility concentration, not increase it.

## 17. Implementation Guidance
Future implementation package scope reference: GACP-0005 Kernel Convergence.

Certified implementation guidance:
1. Focus only on evidence-backed convergence opportunities from GACI-0004.
2. Candidate scope MAY include deprecating/removing unused legacy kernel placeholders.
3. Candidate scope MAY include eliminating duplicate initialization responsibilities.
4. Candidate scope MAY include clarifying bootstrap-versus-orchestration startup ownership.
5. Candidate scope MAY include tightening orchestration-to-authority service contracts.
6. Candidate scope MAY include removing duplicate service composition paths.
7. Candidate scope MAY include documenting approved orchestration root entrypoints.

Implementation constraints:
1. SHALL NOT create a new kernel framework.
2. SHALL NOT move domain logic into GOP.
3. SHALL NOT redesign runtime.
4. SHALL NOT redesign bootstrap.
5. SHALL NOT redesign registries.
6. SHALL NOT alter public APIs without a separate constitutional decision.
7. SHALL NOT perform broad unrelated refactoring.

## 18. Traceability
Constitutional and package lineage:
- GAF-0001
- GACI-0004
- GACD-0001
- GACD-0002
- GACD-0003
- GACD-0004
- GACD-0005
- GACP-0002A
- GACP-0003
- GACP-0004

Governance and index artifacts:
- genesis/governance/decisions/hall/Hall-of-Decisions.md
- genesis/governance/machine/governance-registry.json
- docs/architecture/0001-genesis-architecture.md
- genesis/governance/standards/Genesis-Standards-Registry.md
- genesis/constitution/gpm-0001/Genesis-Executive-Dashboard.md
- genesis/constitution/gpm-0001/machine/executive-dashboard.json

## 19. Decision Metadata
- Decision ID: GACD-0006
- Title: Kernel Authority Decision
- Status: CERTIFIED
- Authority: genesis/CONSTITUTION.md
- Owner: Genesis Architecture and Runtime Authority
- Decision Type: Constitutional Architecture Authority
- Lifecycle: ACTIVE
- Current Implementation State: TRANSITIONAL HYBRID
- Target Implementation State: MINIMAL ORCHESTRATION ROOT

## Validation Record
- No implementation files modified: VERIFIED
- No runtime behavior changed: VERIFIED
- No kernel implementation changed: VERIFIED
- No placeholder files modified: VERIFIED
- No generated evidence changed: VERIFIED
- Governance registries parse successfully: VERIFIED
- Cross references resolve: VERIFIED
- Decision metadata consistency verified: VERIFIED
- Governance and constitutional index artifacts only: VERIFIED
