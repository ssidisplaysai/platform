# ADR-0001: Compiler Architecture

Status: Approved
Date: 2026-07-21
Decision Owners: Architecture Governance, Compiler Platform
Approval: Approved 2026-07-27 by Architecture Governance and Engineering Governance under GARR-0001A remediation authority

## 1. Decision Scope

Define whether the repository currently contains complementary compiler subsystems, overlapping duplication, or transitional duplication, and define the consolidation direction without implementation.

## 2. Problem Statement

The repository contains two active compiler surfaces:

1. TypeScript compiler platform under src/compiler focused on deterministic pass orchestration and semantic compilation contracts.
2. GDK/CLI compiler platform under tools/genesis/compiler focused on entity/module/application/solution generation and runtime-oriented artifact assembly.

Both are called "compiler" and both expose registries, pipelines, diagnostics, and manifests. Architectural ambiguity increases risk of drift, duplicated policy, and non-deterministic governance outcomes.

## 3. Repository Evidence

| Fact ID | Evidence | Observation |
| --- | --- | --- |
| C1 | src/compiler/index.ts | Exports CompilerCore, CompilerPipeline, pass registries, and BusinessGenome compiler symbols from one TS compiler surface. |
| C2 | src/compiler/core/CompilerPipeline.ts | Implements deterministic topological pass ordering, contract validation, artifact/manifest creation, and fatal boundary checks. |
| C3 | tests/compiler/core/*.test.ts and tests/compiler/genome/*.test.ts | TS compiler surface has deep coverage for determinism, pass contracts, and genome pass behavior. |
| C4 | tools/genesis/genesis.mjs and tools/genesis/commands/compile.mjs | CLI compile command routes to CodeGenerationEngine and module/application/solution compilers. |
| C5 | tools/genesis/compiler/CodeGenerationEngine.mjs and tools/genesis/compiler/compiler/ModuleCompiler.mjs | GDK compiler surface performs generation, file output, module contract rendering, and packaging-oriented assembly. |
| C6 | tools/genesis/tests/suites/CompilerTests.mjs and related suites | GDK compiler/runtime surfaces have separate test harness and test suites. |
| C7 | genesis/compiler/GCC-0001-Genesis-Compiler-Core-Architecture-v1.0.md | Normative compiler-core specification defines deterministic pass governance boundaries. |
| C8 | genesis/compiler/BGC-0001-Business-Genome-Compiler-Architecture-v1.0.md | Normative semantic compiler specification defines ordered pass contracts for Business Genome. |
| C9 | docs/architecture/0014-genesis-compilation-pipeline.md | ADR describes definition-to-runtime pipeline centered on planner/compiler split and dry-run governance. |

## 4. Facts vs Interpretation

### 4.1 Facts

1. Two compile-capable stacks exist and are both active in code and tests.
2. TS stack is specification-aligned to GCC/BGC pass-governed semantic compilation.
3. GDK stack is operationally aligned to entity/module/application/solution generation and runtime payload creation.
4. Both stacks maintain compiler-like abstractions (registry, pipeline, diagnostics), but with different IO and outcomes.

### 4.2 Interpretation

1. The current state is transitional duplication with partial complementarity, not pure redundancy.
2. Overlap is real at architecture vocabulary and governance responsibility level.
3. Consolidation is required at boundary contract level before any implementation unification.

## 5. Decision

The architecture will treat compiler responsibilities as two bounded authorities:

1. Semantic Compiler Authority: src/compiler is authoritative for deterministic semantic pass orchestration, Evidence IR to Business Genome semantics, and compiler-core contracts tied to GCC-0001 and BGC-0001.
2. Artifact Assembly Compiler Authority: tools/genesis/compiler is authoritative for generation and assembly of deployable entity/module/application/solution artifacts for current CLI workflows.

Supersedence and transition posture:

1. No immediate physical deprecation is approved in Sprint 0.5.
2. Shared capabilities must be moved under explicit contract ownership, not duplicate ownership.
3. Future supersedence decisions are gated by interface compatibility tests and governance approval.

Shared abstraction contract to be established (spec-level only in this sprint):

1. Canonical compiler session envelope: input identity, pass/step identity, diagnostics, immutable manifest.
2. Canonical handoff artifact envelope between semantic compiler outputs and assembly compiler inputs.
3. Compiler conformance matrix spanning both test frameworks.

## 6. Consumers, IO, and Governance Boundaries

Consumers:

1. TS compiler consumers: semantic pipeline tests and future canonical semantic promotion workflows.
2. GDK compiler consumers: CLI commands, generated artifact builders, runtime boot artifact producers.

IO boundaries:

1. TS compiler IO is pass-contract driven and manifest-sealed.
2. GDK compiler IO is file/discovery/manifest generation driven.

Governance:

1. Architecture authority follows docs/governance/REPOSITORY_GOVERNANCE_GUIDE.md and docs/governance/OWNERSHIP_MATRIX.md.
2. Compiler Platform owner remains accountable for cross-surface conformance.

## 7. Alternatives Considered

### Alternative A: Keep both as independent permanent compilers

Advantages:

1. No migration risk now.
2. Teams can move independently.

Disadvantages:

1. Duplicate governance burden remains.
2. Drift risk increases over time.

Migration impact:

1. Minimal immediate change.
2. High long-term reconciliation cost.

Compatibility:

1. High short-term compatibility.
2. Low long-term semantic consistency confidence.

Risks:

1. Conflicting compiler truth definitions.

### Alternative B: Immediate merge into a single implementation

Advantages:

1. Single authority quickly.

Disadvantages:

1. High disruption across CLI and TS tests.
2. Requires broad refactor without settled contracts.

Migration impact:

1. Large and risky.

Compatibility:

1. Potential regressions in both stacks.

Risks:

1. Runtime and generation breakage.

### Alternative C: Bounded dual-authority with contract-first consolidation (selected)

Advantages:

1. Preserves working surfaces while reducing ambiguity.
2. Enables measurable convergence.

Disadvantages:

1. Temporary complexity remains.

Migration impact:

1. Moderate and staged.

Compatibility:

1. Strong near-term compatibility.

Risks:

1. Governance slippage if conformance gates are not enforced.

## 8. Unresolved Uncertainty

1. Exact long-term execution topology between semantic outputs and assembly inputs is not yet encoded in one contract artifact.
2. Repository history indicates active evolution in compiler branches; final unification point is not yet approved.
3. Expected level of direct runtime integration from semantic compiler outputs remains partly specified in docs but not fully implemented in checkout.

## 9. Approval Record

Requested approvers:

1. Architecture Governance Board
2. Compiler Platform Owner
3. Testing Owner

Approval decision: 
Approval date: 
Notes: 
