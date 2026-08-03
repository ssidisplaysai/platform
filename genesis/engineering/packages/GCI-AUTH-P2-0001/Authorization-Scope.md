# Authorization Scope

## IBR Definition
IBR means Identity, Behavior, Relationships.

The IBR Runtime is the semantic bridge from Replay Runtime artifacts to normalized deterministic semantic observations.

## Allowed Responsibilities
- Interpret deterministic replay artifacts.
- Normalize observation records for later semantic runtimes.
- Preserve source lineage, provenance, and certification linkage references.
- Emit deterministic observation versions.

## Inputs
- Replay Runtime records and trace context.
- Manifest linkage references.
- Evidence linkage references.
- Governance policy constraints from architecture package.

## Outputs
- Deterministic normalized semantic observations.
- Observation identity, lineage, and version metadata.
- Explicit confidence and trace context placeholders for downstream consumers.

## Explicitly Out of Scope
- Canonical entity creation.
- Canonical relationship creation.
- Business rule evaluation.
- Business Genome assembly.
- Any downstream runtime implementation.
- Any non-runtime infrastructure domain.