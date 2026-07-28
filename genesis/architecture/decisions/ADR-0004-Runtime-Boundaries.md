# ADR-0004: Runtime Boundaries

Status: Approved
Date: 2026-07-21
Decision Owners: Runtime Platform, Architecture Governance, Security
Approval: Approved 2026-07-27 by Architecture Governance and Engineering Governance under GARR-0001A remediation authority

## 1. Decision Scope

Define ownership boundaries for runtime lifecycle, identity, execution, orchestration, persistence, routing, scheduling, workflow, dependency resolution, and registration. Define allowed and prohibited dependencies between runtime-related subsystems.

## 2. Problem Statement

Runtime responsibilities are distributed across two implemented surfaces and one placeholder surface:

1. src/core/runtime metadata runtime.
2. tools/genesis/runtime boot/execution/runtime bus and gateway ecosystem.
3. src/core/kernel and src/core/registry placeholders.

Without explicit boundaries, runtime evolution risks duplication, circular dependencies, and policy bypass.

## 3. Repository Evidence

| Fact ID | Evidence | Observation |
| --- | --- | --- |
| B1 | src/core/runtime/MetadataRuntime.ts | Runtime metadata boot validates and registers entity definitions, currently centered on definition loading/validation readiness. |
| B2 | src/core/kernel/*.ts and src/core/registry/*.ts | Kernel and registry contracts exist but are 0-byte placeholders in current checkout. |
| B3 | tools/genesis/commands/boot.mjs | Runtime boot command defines and invokes 12-stage runtime initialization flow. |
| B4 | tools/genesis/runtime/RuntimeBootPipeline.mjs | Implements orchestration stages including registration and dependency resolution. |
| B5 | tools/genesis/commands/runtime.mjs | Runtime diagnostics consume boot manifest outcomes and registration/discovery counters. |
| B6 | tools/genesis/commands/execute.mjs | Runtime execution interface exposes command/query/event/automation/api surfaces. |
| B7 | docs/architecture/0003-runtime.md and genesis/architecture/runtime-lifecycle.md | Declared runtime role is orchestration with predictable lifecycle and presentation independence. |
| B8 | docs/architecture/0011-api-gateway.md | API gateway architecture is documented in runtime terms; current checkout has no confirmed src/app/api route implementation for this surface. |

## 4. Facts vs Interpretation

### 4.1 Facts

1. MetadataRuntime is implemented and focused on metadata validation/registration readiness.
2. Runtime boot/orchestration/execution in tools/genesis/runtime is implemented and broad.
3. Core kernel/registry implementation is incomplete.
4. Runtime API gateway architecture is documented; concrete app route integration is not present in the current checkout state used for this sprint.

### 4.2 Interpretation

1. Runtime authority is currently split across control-plane runtime orchestration and definition-plane metadata runtime.
2. A boundary declaration is necessary before implementing kernel/registry placeholders.

## 5. Decision

Runtime boundaries are declared as a two-plane model:

1. Control Plane Runtime Authority: tools/genesis/runtime and tools/genesis/commands own orchestration, staged boot lifecycle, dependency resolution, execution routing, and runtime registration operations.
2. Definition Plane Runtime Authority: src/core/runtime owns metadata loading, entity definition validation, and readiness evaluation at the app-domain metadata boundary.

Responsibility ownership map:

1. Lifecycle orchestration: Control Plane.
2. Identity assignment during runtime registration: Control Plane, using upstream canonical identities.
3. Execution (command/query/event/automation/api dispatch): Control Plane.
4. Persistence abstractions for runtime buses and operational stores: Control Plane.
5. Routing/gateway behavior: Control Plane.
6. Scheduling and workflow orchestration: Control Plane.
7. Dependency resolution and registration sequencing: Control Plane.
8. Entity definition validation and registration eligibility: Definition Plane.

Kernel and registry placeholders:

1. src/core/kernel and src/core/registry are reserved for future contract adapters.
2. They must not become an alternate orchestration plane.

## 6. Allowed and Prohibited Dependencies

Allowed dependencies:

1. Control Plane may consume generated manifests and validated metadata artifacts.
2. Definition Plane may expose validated definition summaries/attestations to Control Plane.
3. Runtime diagnostics may read boot manifests and registration state outputs.

Prohibited dependencies:

1. Definition Plane must not directly invoke command/query/event/workflow execution buses.
2. Control Plane must not bypass definition validation by constructing ad-hoc entity models.
3. Kernel/registry future implementations must not duplicate full boot pipeline orchestration already owned by Control Plane.
4. Presentation/UI modules must not become runtime authority owners.

## 7. Alternatives Considered

### Alternative A: Move all runtime authority immediately to src/core/runtime

Advantages:

1. Single runtime namespace.

Disadvantages:

1. Large migration from implemented tools/genesis runtime ecosystem.

Migration impact:

1. High and risky.

Compatibility:

1. Breakage risk for existing CLI/runtime tests.

Risks:

1. Delivery interruption and regressions.

### Alternative B: Keep split runtime with no declared boundaries

Advantages:

1. No immediate governance overhead.

Disadvantages:

1. Continues ambiguity and duplicate ownership risk.

Migration impact:

1. Defers cost.

Compatibility:

1. Stable short-term; unstable long-term.

Risks:

1. Uncontrolled divergence.

### Alternative C: Two-plane runtime authority with strict dependency rules (selected)

Advantages:

1. Matches implemented reality while introducing governance guardrails.
2. Enables staged completion of kernel/registry contracts.

Disadvantages:

1. Temporary complexity remains.

Migration impact:

1. Moderate and staged.

Compatibility:

1. High near-term compatibility.

Risks:

1. Requires conformance tests and ownership enforcement.

## 8. Unresolved Uncertainty

1. Precise adapter API between Definition Plane outputs and Control Plane registration input is not yet codified.
2. Scheduler/workflow ownership details in runtime buses require explicit conformance matrixing against documentation.
3. API gateway documentation and implemented app route surface are currently out of sync in checkout evidence.

## 9. Approval Record

Requested approvers:

1. Runtime Platform Owner
2. Architecture Governance Board
3. Security Owner
4. Compiler Platform Owner

Approval decision: 
Approval date: 
Notes: 
