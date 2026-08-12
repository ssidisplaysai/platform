# GACD-0001 Runtime Authority Certification Decision

Decision ID: GACD-0001
Program: Genesis Stabilization Program
Package: GACD-0001
Type: Constitutional Engineering Decision
Status: CERTIFIED
Date: 2026-07-28
Evidence Package: GACI-0001
Owner: Genesis Architecture and Runtime Authority
Approval: APPROVED
Supersedes: None
Superseded By: None

## 1. Executive Summary
This package certifies the runtime authority finding produced by GACI-0001.

Genesis has one certified authoritative runtime for production execution:
- src/platform/gop/runtime/orchestration-runtime.ts

This decision is constitutional and documentary only. It introduces no implementation mutation.

## 2. Decision
GACD-0001 certifies that the Genesis GOP Orchestration Runtime is the single authoritative runtime of the Genesis Enterprise Operating System.

Certified authority chain:
- Authoritative runtime entrypoint: src/platform/gop/runtime/orchestration-runtime.ts
- Orchestration ownership: src/platform/gop/runtime/orchestrator.ts
- Lifecycle ownership: src/platform/gop/runtime/execution-engine.ts and src/platform/gop/runtime/orchestrator.ts

Non-authoritative runtime domains:
- Tool runtime: tooling only
- Compiler runtime: compilation only
- Simulation runtime: simulation only
- MetadataRuntime: legacy, non-authoritative

## 3. Constitutional Statement
By constitutional engineering authority and based on admissible repository evidence, Genesis SHALL recognize exactly one authoritative runtime for production execution.

The authoritative runtime certified by this decision is:
- src/platform/gop/runtime/orchestration-runtime.ts

All subordinate runtime-capable artifacts remain subordinate to this authority and SHALL NOT supersede it without a successor constitutional decision.

## 4. Runtime Authority
Authoritative Runtime:
- src/platform/gop/runtime/orchestration-runtime.ts

Authority Basis:
1. Production API and service flows consume GOP orchestration runtime through active source paths.
2. GOP orchestration runtime owns queueing, dispatch, worker leasing, retries, replay, and persistence integration.
3. GOP runtime is exported as platform runtime surface in src/platform/gop/index.ts.
4. Tool runtime stack under tools/genesis/runtime is consumed by CLI/testing/tool workflows, not production application entrypoints.

## 5. Runtime Responsibility Matrix
| Runtime Surface | Primary Responsibility | Authority State |
|---|---|---|
| src/platform/gop/runtime/orchestration-runtime.ts | Runtime singleton and authoritative orchestration access | AUTHORITATIVE |
| src/platform/gop/runtime/orchestrator.ts | Execution orchestration, scheduling, worker and lease control | PRODUCTION |
| src/platform/gop/runtime/execution-engine.ts | Execution state model and status transitions | PRODUCTION |
| src/platform/gop/runtime/queue-manager.ts | Queueing, lease lifecycle, dead-letter and retry queue handling | PRODUCTION |
| src/platform/gop/runtime/execution-repository.ts | Durable execution persistence and replay support | PRODUCTION |
| src/platform/gop/runtime/loader.ts and module-bootstrap.ts | Runtime module bootstrap and navigation/runtime enablement | PRODUCTION |
| tools/genesis/runtime/* | Tooling runtime contracts, buses, diagnostics and boot tooling | TOOLING |
| tools/genesis/compiler/pipeline/passes/RuntimeRegistrationPass.mjs | Compiler runtime registration pass | COMPILER |
| tools/genesis/runtime/RuntimeExecutionEngine.mjs | Simulated execution and dry-run behavior | SIMULATION |
| tests/gop/* and tools/genesis/tests/suites/RuntimeTests.mjs | Runtime verification and diagnostics | TEST |
| src/core/runtime/MetadataRuntime.ts | Metadata runtime from legacy/runtime-adjacent model | LEGACY |

## 6. Runtime Classification Table
| Classification | Certified Implementation Scope |
|---|---|
| AUTHORITATIVE | src/platform/gop/runtime/orchestration-runtime.ts |
| PRODUCTION | src/platform/gop/runtime/*, src/platform/gop/auth/runtime.ts, src/platform/gop/workspaces/runtime.ts, domain runtimes under src/lib/gba, src/lib/gea, src/lib/ged |
| TOOLING | tools/genesis/runtime/*, tools/genesis/commands/runtime.mjs, tools/genesis/commands/boot.mjs |
| COMPILER | tools/genesis/compiler/pipeline/passes/RuntimeRegistrationPass.mjs |
| SIMULATION | tools/genesis/runtime/RuntimeExecutionEngine.mjs (simulation/dry-run pathways) |
| TEST | tests/gop/*, tests/gea/*runtime*.test.ts, tests/gba/*runtime*.test.ts, tools/genesis/tests/suites/RuntimeTests.mjs |
| LEGACY | src/core/runtime/MetadataRuntime.ts and supporting metadata runtime files |

## 7. Architectural Invariants
1. Genesis SHALL have exactly one authoritative runtime.
2. All production execution SHALL originate from the certified authoritative runtime.
3. Tooling runtimes SHALL NOT become production authorities.
4. Compiler runtimes SHALL NOT execute production workloads.
5. Simulation runtimes SHALL remain non-authoritative and non-production.
6. Domain runtimes SHALL consume platform runtime authority and SHALL NOT supersede it.
7. Runtime authority SHALL remain singular unless superseded by an explicit constitutional successor decision.

## 8. Evidence
Primary evidence source:
- GACI-0001 Runtime Authority Assessment

Evidence summary:
1. Production consumers reference GOP orchestration runtime via active API/service paths.
2. GOP runtime responsibilities include execution lifecycle, scheduling, orchestration, dependency and durability operations.
3. Tool runtime components are consumed by CLI/tooling/test flows rather than production entrypoints.
4. Legacy metadata runtime has no authoritative production role.

Reason for decision:
- Repository evidence shows one production authority path for runtime execution and clear separation of tooling/compiler/simulation runtime roles.

## 9. Repository Impact
Certification impact: NONE

This package introduces no runtime implementation changes, no dependency changes, and no refactoring.

## 10. Future Convergence
This decision records convergence follow-up packages:
1. GACI-0002 - Dependency Direction Convergence
2. GACI-0003 - Registry Authority Certification
3. GACI-0004 - Generated Artifact Policy

## 11. Decision Metadata
- Decision ID: GACD-0001
- Title: Runtime Authority Certification Decision
- Status: CERTIFIED
- Date: 2026-07-28
- Evidence Package: GACI-0001
- Supersedes: None
- Superseded By: None
- Owner: Genesis Architecture and Runtime Authority
- Approval: APPROVED

## Validation Record
- Runtime code unchanged: VERIFIED
- Governance/documentation-only mutation: VERIFIED
- Cross references present: VERIFIED
- Registry/index updates recorded: VERIFIED
