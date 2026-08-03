# Runtime Responsibilities

## IBR Runtime
Purpose:
- Interpret deterministic replay artifacts into governed business observations.

Inputs:
- Replay records and trace context.

Outputs:
- Observation records with source linkage and confidence context.

Contracts:
- Input immutability preservation.
- Deterministic interpretation functions.

Invariants:
- Same replay input yields same observation output.
- Source lineage remains explicit.

Certification expectations:
- determinism
- traceability
- boundary enforcement

Forbidden responsibilities:
- entity canonization
- relationship authoring
- rule evaluation
- persistence/orchestration/scheduling/deployment/AI

## Entity Runtime
Purpose:
- Establish canonical business entities with deterministic identity.

Inputs:
- Observation records and policy constraints.

Outputs:
- Canonical entity versions and identity mappings.

Contracts:
- deterministic identity derivation
- explicit supersedence model

Invariants:
- identity stability under equivalent canonical input
- version append-only behavior

Certification expectations:
- identity validation
- determinism
- lineage integrity

Forbidden responsibilities:
- relationship decisioning
- rule execution
- orchestration and persistence

## Relationship Runtime
Purpose:
- Define and govern directional versioned relationships among canonical entities.

Inputs:
- Canonical entities and relationship evidence constraints.

Outputs:
- Directional relationship versions with lineage.

Contracts:
- directional semantics required
- source/target identity must be canonical

Invariants:
- no undirected relationship state
- replayable deterministic relationship construction

Certification expectations:
- directional integrity
- dependency boundary enforcement
- replayability

Forbidden responsibilities:
- rule arbitration
- Business Genome Assembly Runtime finalization

## Business Rule Runtime
Purpose:
- Evaluate deterministic business behavior and policy constraints.

Inputs:
- Canonical entities, relationships, and rule definitions.

Outputs:
- Deterministic rule evaluations and governed outcomes.

Contracts:
- pure deterministic evaluation functions
- explicit policy and constraint references

Invariants:
- equivalent inputs produce equivalent rule outputs
- evaluation history remains append-only

Certification expectations:
- determinism
- policy traceability
- conflict handling reproducibility

Forbidden responsibilities:
- entity identity mutation
- orchestration/scheduling/persistence/AI

## Business Genome Assembly Runtime
Purpose:
- Deterministically compile entities, relationships, rules, ownership, causality, and lineage into one canonical Business Genome.

Inputs:
- Canonical semantic versions from upstream Phase 2 runtimes.

Outputs:
- Versioned Business Genome artifacts.

Contracts:
- deterministic assembly order
- explicit lineage closure

Invariants:
- no hidden mutation
- canonical genome identity per version

Certification expectations:
- deterministic assembly
- complete lineage
- boundary conformance

Forbidden responsibilities:
- upstream runtime redesign
- uncontrolled inference
- persistence/orchestration/scheduling/deployment/AI