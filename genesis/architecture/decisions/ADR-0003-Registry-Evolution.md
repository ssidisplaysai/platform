# ADR-0003: Registry Evolution

Status: Approved
Date: 2026-07-21
Decision Owners: Compiler Platform, Runtime Platform, Architecture Governance
Approval: Approved 2026-07-27 by Architecture Governance and Engineering Governance under GARR-0001A remediation authority

## 1. Decision Scope

Map current registry surfaces, define whether an "Enterprise Registry" should evolve from existing registry concepts, and establish consolidation direction without implementation.

## 2. Problem Statement

Multiple registries exist across compiler and runtime surfaces with overlapping language but different responsibilities. Some intended core registry files are stubs. The architecture requires a decision on whether to introduce a net-new central registry or evolve existing registries under explicit contract rules.

## 3. Repository Evidence

| Fact ID | Evidence | Observation |
| --- | --- | --- |
| R1 | src/compiler/core/CompilerPassRegistry.ts and src/compiler/core/CompilerPipeline.ts | TS compiler uses pass registry for deterministic pass resolution and contract-bound orchestration. |
| R2 | src/compiler/index.ts | Exposes CompilerPassRegistry and BusinessGenomePassRegistry symbols as first-class compiler APIs. |
| R3 | tools/genesis/compiler/registry/DefinitionRegistry.mjs and DefinitionLoader.mjs | GDK compiler has independent definition registry/index/loading flow with canonical naming rules. |
| R4 | tools/genesis/runtime/RuntimeBootPipeline.mjs | Runtime boot tracks discoveries, validations, registrations, and registryEntries in a runtime-specific orchestration context. |
| R5 | tools/genesis/commands/runtime.mjs | Runtime diagnostics reports discovered and registered component counts from boot manifest outputs. |
| R6 | src/core/registry/EntityDefinition.ts, EntityFactory.ts, EntityRegistry.ts | Intended core runtime registry files exist but are 0 bytes in current checkout. |
| R7 | docs/architecture/0015-runtime-registration-promotion.md | Architectural intent includes promotion/registration pipeline with staged registration behavior. |
| R8 | genesis/architecture/GENESIS_DUPLICATE_ANALYSIS.md and GENESIS_GAP_ANALYSIS.md | Existing recovery docs already flag registry duplication and contract ambiguity risks. |

## 4. Facts vs Interpretation

### 4.1 Facts

1. Registry patterns are already contextualized by subsystem (compiler pass registry, definition registry, runtime boot registration state).
2. There is no implemented unified enterprise-wide registry module in current checkout.
3. src/core/registry exists structurally but is not implemented.

### 4.2 Interpretation

1. Registry plurality is legitimate by bounded context, but contract rules are under-specified.
2. Introducing a brand new "Enterprise Registry" now would likely create additional duplication before authority boundaries are stabilized.

## 5. Decision

The repository will not introduce a net-new monolithic "Enterprise Registry" in Sprint 0.5.

Instead, registry evolution is approved as federated registry contracts:

1. Compiler Pass Registry Authority: src/compiler/core pass registry contracts for semantic compilation.
2. Definition Registry Authority: tools/genesis/compiler/registry for definition discovery and canonical naming within GDK flows.
3. Runtime Registration Authority: tools/genesis/runtime boot and execution registries for operational registration state.
4. Core Runtime Registry Target: src/core/registry becomes a typed runtime-facing contract adapter only after runtime boundary ADR approval and entity schema authority implementation.

Required cross-registry invariants (spec requirement):

1. Deterministic listing and lookup behavior.
2. Explicit lifecycle state model for registration entries.
3. Idempotent registration semantics.
4. Compatibility/version metadata at registration boundary.
5. Traceable diagnostics and manifest lineage.

## 6. Registry Map (Current)

1. src/compiler/core/CompilerPassRegistry.ts: pass contract registration and resolve.
2. src/compiler/genome/* pass registry symbols: semantic pass ordering/governance for Business Genome pipeline.
3. tools/genesis/compiler/registry/*: definition catalog and canonical name resolution.
4. tools/genesis/runtime/*: runtime boot registration state and diagnostics-facing counts.
5. src/core/registry/*: placeholder contracts not yet implemented.

## 7. Alternatives Considered

### Alternative A: Introduce new Enterprise Registry immediately

Advantages:

1. Single place by name.

Disadvantages:

1. Adds a third authority layer before existing authorities are stabilized.

Migration impact:

1. Broad rewiring effort.

Compatibility:

1. High regression risk in both compiler and runtime flows.

Risks:

1. New duplicate abstraction instead of consolidation.

### Alternative B: Keep all registries fully independent with no shared invariants

Advantages:

1. No near-term coordination cost.

Disadvantages:

1. Governance and drift risks remain unbounded.

Migration impact:

1. Low immediate; high eventual correction cost.

Compatibility:

1. Short-term stable, long-term fragile.

Risks:

1. Silent incompatibility across promotion/runtime boundaries.

### Alternative C: Federated registries with shared invariants and adapter target (selected)

Advantages:

1. Preserves bounded contexts.
2. Enables measurable convergence without disruptive rewrite.

Disadvantages:

1. Requires conformance discipline.

Migration impact:

1. Moderate and incremental.

Compatibility:

1. Strong near-term compatibility with current stacks.

Risks:

1. Contract debt if invariants are not tested.

## 8. Unresolved Uncertainty

1. Exact API of src/core/registry adapter contracts remains undefined because runtime and schema authorities are still transitional.
2. Registry identity model alignment across semantic compiler outputs and runtime registration entries is not yet codified.
3. Operational expectations for cross-registry rollback and replay are documented but not uniformly implemented.

## 9. Approval Record

Requested approvers:

1. Compiler Platform Owner
2. Runtime Platform Owner
3. Architecture Governance Board
4. Testing Owner

Approval decision: 
Approval date: 
Notes: 
