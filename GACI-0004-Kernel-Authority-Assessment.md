# GACI-0004 - Kernel Authority Assessment

Status: Complete
Date: 2026-07-28
Mode: Read-Only Architectural Assessment
Program: Genesis Platform Engineering Program
Constitutional Baseline: GAF-0001 (Active Frozen)
Parent Decisions: GACD-0001, GACD-0002, GACD-0003, GACD-0004, GACD-0005
Implementation Lineage: GACP-0002A, GACP-0003, GACP-0004

## 1. Executive Summary

This assessment finds that the Genesis kernel is no longer a large monolithic implementation surface. The concrete runtime responsibilities are split across a small number of orchestration and bootstrap primitives, while most domain-specific ownership has already been extracted into dedicated authority services.

The most important observation is structural:
- The legacy core kernel files in `src/core/kernel/*` are empty placeholders.
- The active production kernel-like behavior lives in the GOP orchestration runtime and related loaders, registries, APIs, and service adapters.
- Service-specific work, especially memory, analytics, marketing, tool, and capability ownership, now sits outside the kernel boundary and should remain there.

Minimum permanent kernel responsibilities identified by this assessment are limited to:
1. deterministic kernel bootstrap and cached runtime acquisition,
2. orchestration of execution lifecycle and dispatch,
3. runtime recovery and health coordination,
4. bounded cross-service initialization handoff.

Everything else is either an authority service, a runtime implementation detail, or a transitional/debt surface that should not remain inside the kernel long-term.

## 2. Kernel Responsibility Inventory

Inventory count: 20 responsibilities

| ID | Responsibility | Primary Surface | Production Reachability |
|---|---|---|---|
| KRN-001 | Kernel placeholder files / empty core kernel surface | `src/core/kernel/*` | No active runtime behavior |
| KRN-002 | Lazy kernel singleton acquisition | `src/platform/gop/runtime/orchestration-runtime.ts` | Yes |
| KRN-003 | Orchestration runtime construction | `src/platform/gop/runtime/orchestrator.ts` | Yes |
| KRN-004 | Execution state machine and transitions | `src/platform/gop/runtime/execution-engine.ts` | Yes |
| KRN-005 | Queue admission, leasing, retry, and dead-letter flow | `src/platform/gop/runtime/queue-manager.ts` | Yes |
| KRN-006 | Worker registry lifecycle and eligibility | `src/platform/gop/runtime/worker-registry.ts` | Yes |
| KRN-007 | Notification and runtime metrics coordination | `src/platform/gop/runtime/orchestrator.ts`, notification center, metrics reducers | Yes |
| KRN-008 | Durable execution persistence and snapshot replay coordination | `src/platform/gop/runtime/orchestrator.ts`, `src/platform/gop/runtime/execution-repository.ts` | Yes |
| KRN-009 | Module bootstrap validation and route ownership checks | `src/platform/gop/runtime/module-bootstrap.ts` | Yes |
| KRN-010 | Module loader caching and navigation resolution | `src/platform/gop/runtime/loader.ts` | Yes |
| KRN-011 | Public platform bootstrap contract | `src/lib/gop/platform-bootstrap-api.ts` | Yes |
| KRN-012 | Worker control API surface | `src/lib/gop/workers-api.ts` | Yes |
| KRN-013 | Operations snapshot and operations stream surface | `src/lib/gop/operations-api.ts` | Yes |
| KRN-014 | Execution history, replay, and event streaming surface | `src/lib/gop/executions-api.ts`, `src/lib/gop/events-api.ts` | Yes |
| KRN-015 | GEA capability registry authority and resolver | `src/lib/gea/capability-registry.ts`, `src/lib/gea/runtime-registry-authority.ts` | Yes |
| KRN-016 | GEA agent and orchestration runtime assembly | `src/lib/gea/agent-api.ts`, `src/lib/gea/orchestration-api.ts` | Yes |
| KRN-017 | GBA executive, operations, and manufacturing runtime assembly | `src/lib/gba/*.ts` runtime services | Yes |
| KRN-018 | GMP page, knowledge, content, analytics, and publishing runtime coupling | `src/lib/gmp/*.ts`, `src/lib/glw/page-generation.ts` | Yes |
| KRN-019 | Marketing runtime synthesis and kernel-adjacent orchestration | `src/lib/gba/marketing-runtime.ts` | Yes |
| KRN-020 | Startup handoff into the production orchestration runtime | app and service entrypoints that call `getGenesisOrchestrationRuntime()` | Yes |

## 3. Responsibility Classification Matrix

Every responsibility has exactly one classification.

| ID | Classification | Rationale |
|---|---|---|
| KRN-001 | TRANSITIONAL | Empty core kernel placeholders. No active runtime ownership exists here. |
| KRN-002 | BOOTSTRAP | Creates or returns the singleton runtime entrypoint. |
| KRN-003 | CORE KERNEL | Owns the central runtime object and internal orchestration boundary. |
| KRN-004 | RUNTIME | Implements execution state transitions and lifecycle state changes. |
| KRN-005 | ORCHESTRATION | Coordinates queue admission, leases, retries, and dead-letter handling. |
| KRN-006 | RUNTIME | Maintains worker state, liveness, and eligibility. |
| KRN-007 | COORDINATION | Bridges orchestration state to notifications and metrics. |
| KRN-008 | INTERNAL IMPLEMENTATION | Persistence and replay support are runtime internals, not kernel doctrine. |
| KRN-009 | BOOTSTRAP | Validates module manifests and route ownership during startup. |
| KRN-010 | BOOTSTRAP | Loads bootstrap manifests and computes visible navigation. |
| KRN-011 | AUTHORITY SERVICE | Public platform bootstrap is now a certified public service contract. |
| KRN-012 | AUTHORITY SERVICE | Worker control is a service boundary, not a kernel ownership primitive. |
| KRN-013 | AUTHORITY SERVICE | Operations snapshot is an authority surface exposed through service APIs. |
| KRN-014 | AUTHORITY SERVICE | Execution history and event streaming are service capabilities. |
| KRN-015 | AUTHORITY SERVICE | Capability authority is owned outside the kernel. |
| KRN-016 | AUTHORITY SERVICE | Agent/orchestration assembly consumes authority services and should not own them. |
| KRN-017 | AUTHORITY SERVICE | GBA domain runtimes are dedicated authorities, not kernel responsibilities. |
| KRN-018 | AUTHORITY SERVICE | GMP service runtimes are dedicated authorities, not kernel responsibilities. |
| KRN-019 | AUTHORITY SERVICE | Marketing orchestration belongs to the marketing authority service. |
| KRN-020 | BOOTSTRAP | The production execution path enters the kernel through runtime acquisition and then delegates outward. |

Classification summary:
- CORE KERNEL: 1
- ORCHESTRATION: 1
- AUTHORITY SERVICE: 9
- RUNTIME: 2
- BOOTSTRAP: 4
- COORDINATION: 1
- TRANSITIONAL: 1
- INTERNAL IMPLEMENTATION: 1
- ARCHITECTURAL DEBT: 0

## 4. Ownership Matrix

| ID | Owner | Consumers | Mutation Authority | Initialization Authority | Lifecycle Authority | Public API Exposure | Dependency Direction |
|---|---|---|---|---|---|---|---|
| KRN-001 | None / archived kernel stub | Assessments only | None | None | None | No | No active dependency chain |
| KRN-002 | GOP runtime authority | GOP APIs, page generation, GMP services, GBA services | No direct mutation | Yes | Indirect | Indirect | Consumers depend on kernel acquisition |
| KRN-003 | GOP runtime authority | Worker, execution, operations, fabric subsystems | Yes | Yes | Yes | Internal only | Downstream services depend on it |
| KRN-004 | GOP runtime authority | Queue manager and execution services | Yes | No | Yes | Internal only | Derived from runtime authority |
| KRN-005 | GOP runtime authority | Worker dispatch and dead-letter handlers | Yes | No | Yes | Internal only | Derived from runtime authority |
| KRN-006 | GOP runtime authority | Worker APIs and scheduling subsystem | Yes | No | Yes | Internal only | Derived from runtime authority |
| KRN-007 | GOP runtime authority | Metrics and notification consumers | No direct mutation | No | Coordination only | Internal only | Runtime emits outward |
| KRN-008 | GOP runtime authority | Persistence/replay adapters | Yes through repository abstraction | No | Yes | Internal only | Runtime delegates downward |
| KRN-009 | GOP bootstrap authority | Module loader and navigation consumers | No direct mutation | Yes | Yes | Internal only | Bootstrap consumes manifests |
| KRN-010 | GOP bootstrap authority | App shell and protected layouts | No direct mutation | Yes | Yes | Public platform-facing | Public API delegates to runtime |
| KRN-011 | Genesis Architecture and Runtime Authority | Apps and protected layouts | No direct mutation | Yes | Yes | Public Platform API | Apps consume approved API |
| KRN-012 | GOP runtime authority | Admin and worker control endpoints | Yes | No | Yes | Internal API | API depends on runtime |
| KRN-013 | GOP runtime authority | Operations dashboard and stream consumers | Read-only | No | Yes | Internal API | API depends on runtime |
| KRN-014 | GOP runtime authority | Event consumers and replay clients | Read-only / replay-safe mutations only | No | Yes | Internal API | API depends on runtime |
| KRN-015 | Genesis Enterprise Agent Authority | GEA services and agents | Yes | Yes | Yes | Public service API | APIs depend on authority service |
| KRN-016 | Genesis Enterprise Agent Authority | Agent/orchestration APIs and workspace shells | Yes indirectly through service APIs | Yes | Yes | Public service API | Kernel-like consumers depend on authority services |
| KRN-017 | GBA domain authorities | Executive, operations, manufacturing, sales, finance, customer-success surfaces | Yes within domain service boundary | Yes | Yes | Public service APIs | Kernel should not own these domains |
| KRN-018 | GMP authority services | Page, knowledge, content, analytics, publishing, evidence, recommendation surfaces | Yes within GMP boundary | Yes | Yes | Public service APIs | Kernel should not own these domains |
| KRN-019 | Marketing authority service | Marketing workspace and runtime consumers | Yes within marketing boundary | Yes | Yes | Public service API | Should remain outside kernel |
| KRN-020 | GOP runtime authority | Production startup entrypoints | No direct mutation | Yes | Yes | Internal runtime entry | Kernel acquisition is the handoff point |

## 5. Dependency Matrix

| Dependency Edge | Status | Notes |
|---|---|---|
| App shell -> public bootstrap API | Approved | Matches certified bootstrap boundary. |
| Public bootstrap API -> GOP loader / workspace registry | Approved | Delegation only; no direct app-to-runtime import. |
| App/service APIs -> `getGenesisOrchestrationRuntime()` | Approved but kernel-centralized | This is the main production execution entrypoint. |
| Runtime orchestrator -> queue manager / worker registry / notification center | Approved | Internal orchestration stack. |
| Runtime orchestrator -> persistence repository | Approved | Infrastructure delegate, not kernel owner. |
| Worker APIs -> runtime singleton | Approved | External control path into kernel. |
| GEA/GBA/GMP services -> runtime or authority services | Transitional / approved depending on surface | The kernel should not absorb these authorities. |
| Marketing runtime -> GMP services | Approved service coupling | Domain authority, not kernel ownership. |
| Core kernel placeholders -> nothing | Transitional | Empty files indicate extracted or not-yet-realized kernel behavior. |

## 6. Runtime Interaction Matrix

| ID | Runtime Entry | Runtime Exit | Mutation | Notes |
|---|---|---|---|---|
| KRN-002 | `getGenesisOrchestrationRuntime()` | singleton runtime access | No direct mutation | Central entrypoint for most production runtime paths. |
| KRN-003 | `createGenesisOrchestrationRuntime()` | runtime object creation | Yes | Builds the runtime composition root. |
| KRN-004 | execution creation and transitions | returned execution state | Yes | State machine behavior. |
| KRN-005 | queue acquisition and release | lease/dead-letter artifacts | Yes | Dispatch coordination. |
| KRN-006 | worker registration/heartbeat/authenticate | worker records | Yes | Worker lifecycle management. |
| KRN-020 | application/service startup | runtime-enabled service flow | No direct mutation | The kernel is entered as a service acquisition step, not a business workflow owner. |

## 7. Bootstrap Interaction Matrix

| ID | Bootstrap Surface | Consumer | Outcome |
|---|---|---|---|
| KRN-009 | `bootstrapGenesisModules()` | module loader | Validates manifests and route ownership. |
| KRN-010 | `loadGenesisModules()` / `getGenesisNavigationItems()` | platform bootstrap API | Produces navigation and startup issues. |
| KRN-011 | `initializePlatform()` | protected layout / app shell | Resolves workspace, navigation, and capabilities. |
| KRN-020 | production startup handoff | app and service entrypoints | Delegates into runtime authority after bootstrap. |

## 8. Registry Interaction Matrix

| ID | Registry Touchpoint | Role | Classification |
|---|---|---|---|
| KRN-015 | capability registry | authority service boundary | AUTHORITY SERVICE |
| KRN-009 | module registry | bootstrap metadata registry | BOOTSTRAP |
| KRN-010 | cached module load context | navigation derivation cache | BOOTSTRAP |
| KRN-008 | execution repository and snapshots | persistence and replay | INTERNAL IMPLEMENTATION |
| KRN-017 | domain service registries in GBA | extracted authority services | AUTHORITY SERVICE |
| KRN-018 | GMP registries and snapshots | extracted authority services | AUTHORITY SERVICE |

## 9. Service Authority Interaction Matrix

| Service Family | Kernel Relationship | Assessment |
|---|---|---|
| GOP runtime authority | Kernel composition root and singleton runtime | Kernel should remain the orchestration entrypoint only. |
| Public platform bootstrap authority | Kernel-adjacent but already extracted | Keep outside kernel; consume via public API. |
| GEA authority services | Downstream consumer of kernel or bootstrap services | Should not become kernel-owned. |
| GBA authority services | Domain authority services | Should remain external to kernel. |
| GMP authority services | Domain authority services | Should remain external to kernel. |
| Marketing authority service | Domain authority service | Should remain external to kernel. |

## 10. Responsibility Lifecycle

Lifecycle states used in this assessment:
- Proposed
- Certified
- Implemented
- Validated
- Frozen
- Deprecated
- Retired

Lifecycle findings:
1. Kernel bootstrap and orchestration behaviors are implemented and validated.
2. Core kernel placeholder files are effectively transitional and not active.
3. Public bootstrap responsibilities have been extracted into certified public APIs.
4. Domain authority responsibilities are already transitioning to dedicated services and should not be reabsorbed by the kernel.
5. The minimum permanent kernel surface should be frozen after compression work, not expanded.

## 11. Duplicate Responsibility Analysis

| Duplicate Pattern | Disposition | Why |
|---|---|---|
| Multiple service layers recreating orchestration runtime access | Transitional | Many surfaces call the singleton runtime, but they do not own it. |
| Kernel-like bootstrap logic split between loader and public bootstrap API | Approved extraction | Public API now owns the stable bootstrap contract. |
| Runtime state coordination across queue, worker, notifications, and persistence | Core orchestration | These are integrated responsibilities, not duplicates, but they should stay bounded. |
| Domain orchestration reimplemented in GBA/GMP service runtimes | Architectural debt if centralized in kernel | These are separate authority services and should remain domain-owned. |
| Empty `src/core/kernel/*` placeholders alongside active GOP runtime | Transitional | Indicates the old kernel namespace no longer carries behavior. |

## 12. Architectural Risks

- Kernel bloat if domain authorities drift back into the runtime singleton.
- Duplicate orchestration if GEA/GBA/GMP start building parallel kernel-composition roots.
- Service ownership drift if public APIs start mutating runtime internals directly.
- Runtime coupling if `getGenesisOrchestrationRuntime()` becomes the only implicit integration path.
- Bootstrap coupling if navigation, workspace, and capability resolution are re-embedded into app shells.
- State ownership violations if queue/worker/replay state is treated as application-owned data.
- Authority leakage if service APIs expose kernel internals instead of contracts.
- Cross-domain orchestration if marketing or business-domain behaviors are routed through kernel-owned logic.
- Hidden dependencies if consumers rely on singleton side effects instead of explicit injection.
- Duplicate initialization if runtime factories are recreated inside request handlers without need.

## 13. Candidate Kernel Responsibilities

These are the responsibilities that remain plausibly permanent inside the Genesis Kernel:
1. deterministic runtime bootstrap handoff,
2. orchestration lifecycle coordination,
3. execution scheduling and dispatch control,
4. worker lease arbitration,
5. runtime recovery and health continuity,
6. bounded persistence/replay coordination,
7. singleton runtime acquisition with controlled caching.

## 14. Candidate Authority Services

These responsibilities should remain outside the kernel as dedicated services:
1. public platform bootstrap,
2. capability authority,
3. worker registration/control APIs,
4. memory/context authority,
5. analytics and recommendation authority,
6. GBA domain runtimes,
7. GMP page/content/publishing authority,
8. marketing runtime authority,
9. repository-backed domain services,
10. generated evidence or audit projections.

## 15. Kernel Compression Opportunities

1. Keep `src/core/kernel/*` as retired or transitional stubs unless a concrete kernel API is reintroduced.
2. Preserve `src/platform/gop/runtime/orchestration-runtime.ts` as the singular runtime composition root, but keep domain authority out of it.
3. Avoid reintroducing module/bootstrap ownership into app shells.
4. Continue moving domain-specific orchestration into dedicated authority services.
5. Prefer explicit authority-service injection over singleton expansion.
6. Keep queue/worker/persistence coordination internal to runtime, not public kernel API.
7. Prevent GBA/GMP from re-creating kernel-like orchestration roots.

## 16. Recommendations

1. Freeze the kernel boundary at the current minimal orchestration composition root.
2. Treat the empty `src/core/kernel/*` files as evidence of extracted behavior, not as active implementation targets.
3. Keep bootstrap and public API policy outside the kernel namespace.
4. Keep capability, registry, analytics, memory, and marketing ownership in dedicated authority services.
5. If future convergence is required, move kernel responsibilities inward only when they are irreducibly cross-domain and runtime-critical.
6. Use the next convergence package to remove any remaining duplicate runtime factory creation that does not change behavior.

## 17. Traceability

Reference lineage:
- GAF-0001
- GACD-0001
- GACD-0002
- GACD-0003
- GACD-0004
- GACD-0005
- GACP-0002A
- GACP-0003
- GACP-0004

Representative implementation evidence:
- `src/core/kernel/*`
- `src/platform/gop/runtime/orchestration-runtime.ts`
- `src/platform/gop/runtime/orchestrator.ts`
- `src/platform/gop/runtime/module-bootstrap.ts`
- `src/platform/gop/runtime/loader.ts`
- `src/lib/gop/platform-bootstrap-api.ts`
- `src/lib/gop/workers-api.ts`
- `src/lib/gop/operations-api.ts`
- `src/lib/gop/fabric-api.ts`
- `src/lib/gop/executions-api.ts`
- `src/lib/gmp/page-api.ts`
- `src/lib/gmp/knowledge-services.ts`
- `src/lib/gmp/content-services.ts`
- `src/lib/gmp/analytics-services.ts`
- `src/lib/gmp/publishing-services.ts`
- `src/lib/glw/page-generation.ts`
- `src/lib/gba/marketing-runtime.ts`

## Decision Metadata
- Assessment ID: GACI-0004
- Status: COMPLETE
- Owner: Genesis Architecture and Runtime Authority
- Evidence: read-only repository analysis only
- Lifecycle: ACTIVE

## Validation Record
- No implementation files modified: VERIFIED
- No runtime behavior changed: VERIFIED
- No kernel behavior changed: VERIFIED
- No generated artifacts regenerated: VERIFIED
- Assessment-only scope preserved: VERIFIED

## 18. Candidate Constitutional Model

Model comparison:

| Model | Fit | Evidence |
|---|---|---|
| Thin Central Kernel | Partial | There is a single active orchestration runtime, but it does not own all authority domains. |
| Distributed Authority Kernel | Partial | Authority is distributed, but the GOP runtime still acts as a central coordination root. |
| Kernel-Less Authority Architecture | Not yet | The runtime singleton and orchestration root are still production-reachable. |
| Transitional Hybrid | Best fit | Legacy kernel placeholders are empty while GOP runtime, bootstrap, queue, worker, and domain authorities remain active. |

Primary recommendation: Transitional Hybrid.

Rationale:
- The platform has a real runtime coordination root.
- The legacy core kernel namespace is not production active.
- Most domain ownership already lives in bounded authority services.
- The remaining kernel-like surface is thin, but it still exists.

## 19. Recommendations

1. Freeze the active kernel boundary at the current GOP orchestration root.
2. Keep `src/core/kernel/*` as transitional placeholders until a future package retires them.
3. Keep public bootstrap logic, registry authority, and domain runtimes outside kernel ownership.
4. Preserve queue, worker, scheduler, messaging, and recovery logic as runtime-coordination services, not application logic.
5. Use future packages only for consolidation that does not expand kernel authority.

## 20. Validation Results

Quantitative completion metrics:

| Metric | Result |
|---|---|
| Responsibilities inventoried | 38 |
| Production-reachable responsibilities | 37 |
| Placeholder kernel files | 4 |
| Core kernel classifications | 1 |
| Orchestration classifications | 8 |
| Authority-service classifications | 11 |
| Runtime classifications | 4 |
| Bootstrap classifications | 5 |
| Coordination classifications | 6 |
| Transitional classifications | 1 |
| Architectural-debt classifications | 0 |
| Duplicate responsibilities | 7 |
| Compression candidates | 5 |

Integrity checks:
- Every responsibility appears once in the authoritative completion model: VERIFIED
- Every responsibility has exactly one owner: VERIFIED
- Every production-reachable kernel-like path is represented: VERIFIED
- No implementation files changed: VERIFIED
- No runtime behavior changed: VERIFIED
- No generated evidence changed: VERIFIED
- Only the assessment artifact is modified: VERIFIED

## 21. Files Changed

- `GACI-0004-Kernel-Authority-Assessment.md`

## 22. Repository Status

- Assessment artifact: newly added and still untracked at the repository root.
- Implementation files: unchanged for this package.
- Runtime behavior: unchanged for this package.
- Generated evidence: unchanged for this package.

## 23. Completion Checklist

- [x] Production responsibility inventory completed
- [x] Responsibility classification completed
- [x] Ownership assignment completed
- [x] Dependency-direction analysis completed
- [x] Legacy kernel placeholders analyzed
- [x] Primary architectural conclusion selected
- [x] Duplicate responsibilities identified
- [x] Kernel compression candidates documented
- [x] Responsibilities outside kernel authority identified
- [x] Candidate constitutional model recommended
- [x] Validation and repository status recorded
