# Genesis Discoveries

This log records discoveries under active governance.
Each discovery is tracked from observation through promotion readiness.

## GD-0001: Businesses exist independently of software.

- Title: Businesses exist independently of software.
- Status: Candidate
- Observation: Organizations operated before modern software systems and continue operations during outages or migrations.
- Evidence: Historical business operations, manual continuity procedures, and operational fallback behavior.
- Impact: Platform models must treat software as representation of business reality, not the business itself.
- Next Step or Promotion Target: Collect cross-domain case evidence and promote to constitutional principle candidate.

## GD-0002: Software is a projection of business reality.

- Title: Software is a projection of business reality.
- Status: Candidate
- Observation: Application behavior reflects assumptions about entities, workflows, policies, and events that originate in business operations.
- Evidence: Domain models and process definitions map to pre-existing business objects and constraints.
- Impact: Compiler passes must preserve business-reality alignment and avoid introducing unsupported semantics.
- Next Step or Promotion Target: Verify projection quality using evidence-to-knowledge traceability checks.

## GD-0003: Knowledge without evidence cannot become canonical.

- Title: Knowledge without evidence cannot become canonical.
- Status: Candidate
- Observation: Unsupported assumptions create unstable architecture and inconsistent generated outcomes.
- Evidence: Prior architectural drift where undocumented assumptions caused rework and policy ambiguity.
- Impact: Governance must reject promotion attempts lacking explicit evidence lineage.
- Next Step or Promotion Target: Formalize minimum evidence bundle required for promotion review.

## GD-0004: Verification must precede generation.

- Title: Verification must precede generation.
- Status: Candidate
- Observation: Generating systems from unverified models propagates defects at scale.
- Evidence: Defect amplification patterns in code generation and configuration-driven systems.
- Impact: Validation gates are mandatory before compiler stages are allowed to emit downstream artifacts.
- Next Step or Promotion Target: Define verification criteria per compiler stage and attach pass/fail controls.

## GD-0005: Every business has a discoverable semantic structure.

- Title: Every business has a discoverable semantic structure.
- Status: Candidate
- Observation: Repeated business analysis reveals recurring entity, relationship, lifecycle, and policy patterns.
- Evidence: Structured analysis across domains consistently identifies stable conceptual structures.
- Impact: Discovery and compiler pipelines should search for structure instead of relying on ad hoc interpretation.
- Next Step or Promotion Target: Build and validate structured discovery heuristics against multiple business domains.

## GD-0006: Every business is a graph.

- Title: Every business is a graph.
- Status: Candidate
- Observation: Business reality is formed by connected entities, events, capabilities, constraints, and dependencies.
- Evidence: Relationship analysis consistently requires graph representation for integrity and traversal.
- Impact: Intermediate representations should preserve graph form and relationship lineage.
- Next Step or Promotion Target: Validate graph completeness and relationship fidelity metrics in compiler outputs.

## GD-0007: Applications are projections, not sources of truth.

- Title: Applications are projections, not sources of truth.
- Status: Candidate
- Observation: Multiple applications frequently represent overlapping slices of the same business reality with divergent abstractions.
- Evidence: Reconciliation work across systems of record reveals projection inconsistencies.
- Impact: Canonical knowledge cannot be defined solely by any single application model.
- Next Step or Promotion Target: Define projection conformance checks against canonical knowledge layers.

## GD-0008: Lineage is mandatory for trust.

- Title: Lineage is mandatory for trust.
- Status: Candidate
- Observation: Teams cannot reliably accept claims they cannot trace to source evidence and transformations.
- Evidence: Audit and incident reviews repeatedly require source-to-decision traceability.
- Impact: All compiler artifacts must preserve source references and transformation history.
- Next Step or Promotion Target: Enforce lineage completeness as a hard validation condition.
