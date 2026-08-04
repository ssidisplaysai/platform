# Canonical Business Genome Rules

## Canonical Identity
- genome identity must be deterministically derived from normalized authorized inputs
- equivalent input sets must yield identical genome identity

## Deterministic Ordering
- assembly ordering rules must be explicit, stable, and reproducible
- no runtime-time randomness or environment-dependent ordering is permitted

## Versioning and Lifecycle
- genome versions are append-only and monotonic
- supersedence references must preserve lineage continuity
- retirement must preserve historical traceability

## Preservation Rules
- unresolved assembly artifacts must be preserved, not discarded
- contradictory evidence must be preserved as immutable trace state

## Registry Rules
- registry behavior must be immutable, deterministic, and audit-safe
- replacement behavior must be explicit and lineage-preserving only
