# Semantic Derivation Rules

Status: Approved
Classification: Genesis Standard

## Purpose

These rules govern how canonical semantics are derived from the seed.
They ensure identity stability, inheritance integrity, and evidence traceability.

## Required Rules

1. Every concept derives from one or more Seed concepts.
- A canonical concept proposal must name all parent seed concepts explicitly.

2. No canonical concept exists without derivation.
- Concepts lacking formal derivation remain non-canonical regardless of implementation usage.

3. Semantic inheritance is additive.
- Child concepts may add constraints or characteristics but may not remove parent meaning.

4. Semantic identity never changes.
- Canonical IDs and core identity semantics are immutable once approved.

5. Relationships cannot violate parent semantics.
- A derived relationship must satisfy all parent endpoint and meaning constraints.

6. Canonical concepts remain implementation independent.
- Concept definition cannot depend on specific runtime technology, API shape, or database model.

7. Evidence lineage must always be preserved.
- Derivation claims must include traceable source evidence and transformation lineage.

## Derivation Evidence Minimum

A derivation package must include:
- parent concept mapping
- semantic delta statement
- evidence references
- verification criteria
- known limitations

## Non-Compliance Outcome

If any required rule is violated:
- derivation is rejected or returned for revision
- concept cannot progress in maturity lifecycle
- compiler compatibility claims are invalid until corrected
