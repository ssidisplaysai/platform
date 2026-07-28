# ADR-0002: Canonical Entity Model

Status: Approved
Date: 2026-07-21
Decision Owners: Canonical Model, Runtime Platform, Compiler Platform
Approval: Approved 2026-07-27 by Architecture Governance and Engineering Governance under GARR-0001A remediation authority

## 1. Decision Scope

Define canonical entity model authority, import direction, serialization/validation boundaries, and migration/control strategy across the currently duplicated entity-definition surfaces.

## 2. Problem Statement

The repository contains multiple entity-definition representations with overlapping intent:

1. YAML definitions under definitions/entity/*.entity.yaml.
2. TypeScript entity definitions under src/domain/definitions/*.definition.ts.
3. Schema contracts under src/domain/schema/*.ts are currently stubs (0-byte files).

Without a declared authority split, compilers and runtime components can diverge in semantics, validation behavior, and identity governance.

## 3. Repository Evidence

| Fact ID | Evidence | Observation |
| --- | --- | --- |
| E1 | definitions/entity/Customer.entity.yaml | Defines customer model in YAML with fields, relationships, capabilities, lifecycle, and metadata. |
| E2 | src/domain/definitions/Customer.definition.ts | Defines customer model as EntitySchema object used by runtime metadata path. |
| E3 | src/core/runtime/MetadataRuntime.ts | Imports CustomerDefinition from src/domain/definitions and validates definitions before runtime readiness. |
| E4 | src/domain/schema/EntitySchema.ts, EntityField.ts, EntityRelationship.ts, SchemaRegistry.ts | Files exist but are 0 bytes in current checkout. |
| E5 | tools/genesis/compiler/registry/DefinitionLoader.mjs and DefinitionRegistry.mjs | GDK definition loading and canonical naming occur in a separate registry path. |
| E6 | tools/genesis/commands/compile.mjs | CLI compile path routes to CodeGenerationEngine and module/application/solution compilers, separate from MetadataRuntime path. |
| E7 | genesis/architecture/GENESIS_GAP_ANALYSIS.md | Existing architecture analysis identified canonical definition ambiguity as a high-priority gap. |

## 4. Facts vs Interpretation

### 4.1 Facts

1. Two active, non-identical entity model representations exist (YAML and TS).
2. Runtime boot currently consumes TS definitions from src/domain/definitions.
3. Domain schema contract files intended for central typing are present but not implemented.
4. GDK compiler definition handling is independent from runtime metadata loader path.

### 4.2 Interpretation

1. Canonical authority is currently split by usage surface, not by explicit architectural rule.
2. The stubs in src/domain/schema indicate an unfinished shared model contract.
3. A control strategy must stabilize authority before implementation proceeds.

## 5. Decision

Canonical authority split is declared as follows:

1. Runtime Canonical Authority (effective now): src/domain/definitions is the canonical executable entity model consumed by src/core/runtime.
2. Authoring/Generation Canonical Authority (effective now): definitions/entity is the canonical authoring substrate for current GDK generation workflows.
3. Contract Canonical Authority (target): src/domain/schema will become the canonical shared contract layer once implemented and approved.

Required import direction rules (architecture rule, no implementation in this sprint):

1. Runtime code may import from src/domain/definitions and src/domain/schema only.
2. Runtime code must not import from definitions/entity directly.
3. GDK compiler may read definitions/entity and emit derived artifacts.
4. Cross-surface synchronization must flow through explicit transformation contracts, never ad-hoc direct coupling.

Serialization and validation boundaries:

1. YAML serialization boundary belongs to GDK definition ingestion and planning/compile pipeline.
2. Runtime validation boundary belongs to MetadataLoader and MetadataValidator using EntitySchema-compatible structures.
3. Promotion into runtime-operational definitions must require validation attestation and manifest traceability.

## 6. Migration and Control Strategy

1. Define a canonical entity mapping contract from YAML authoring model to schema contract model.
2. Implement src/domain/schema as typed authority before any forced de-duplication.
3. Add conformance tests proving structural equivalence between source YAML and runtime TS representation for promoted entities.
4. Block net-new entity fields in one surface unless mapped in the other under governance review.
5. Publish versioned compatibility policy for entity model changes (additive, compatible, breaking).

## 7. Alternatives Considered

### Alternative A: Declare YAML as sole canonical model immediately

Advantages:

1. Single authoring source.

Disadvantages:

1. Breaks current runtime import/validation path.

Migration impact:

1. High near-term runtime refactor cost.

Compatibility:

1. Risky for runtime boot and current tests.

Risks:

1. Uncontrolled runtime semantic drift.

### Alternative B: Declare TS definitions as sole canonical model immediately

Advantages:

1. Aligns with current runtime behavior.

Disadvantages:

1. Disrupts existing GDK authoring flow and current generator assumptions.

Migration impact:

1. High generator refactor burden.

Compatibility:

1. Risky for CLI generation path.

Risks:

1. Loss of current authoring ergonomics and tooling flow.

### Alternative C: Split authority with explicit synchronization controls (selected)

Advantages:

1. Matches implemented reality while reducing ambiguity.
2. Enables staged convergence to schema-contract authority.

Disadvantages:

1. Temporary dual-surface complexity remains.

Migration impact:

1. Moderate and governable.

Compatibility:

1. Preserves both active execution paths.

Risks:

1. Requires strict governance enforcement to prevent silent divergence.

## 8. Unresolved Uncertainty

1. Exact schema shape for src/domain/schema authority is not implemented.
2. Full set of entities with one-to-one parity across YAML and TS has not been formally attested in this sprint.
3. Downstream consumers of generated entity metadata outside runtime are not fully cataloged in one matrix.

## 9. Approval Record

Requested approvers:

1. Canonical Model Owner
2. Runtime Platform Owner
3. Compiler Platform Owner
4. Architecture Governance Board

Approval decision: 
Approval date: 
Notes: 
