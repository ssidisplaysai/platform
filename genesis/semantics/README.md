# Genesis Business Semantics

Status: Approved
Classification: Genesis Standard
Type: Foundational Specification
Sprint: GBS-SEED-0001

## Purpose

The semantics directory defines the canonical semantic foundation of Genesis.
It exists to specify minimal, implementation-independent semantic primitives from which future enterprise concepts can be derived.

This directory is a standards layer, not implementation guidance.
No compiler behavior, runtime behavior, or code generation behavior is defined here.

## Scope of This Sprint

This sprint publishes the seed specification only.
It does not implement semantic processing.
It does not expand ontology beyond five seed primitives.
It does not promote derived concepts to canonical status.

## Document Map

- GBS-1.0.md: Root Genesis Business Semantics specification.
- GBS-SEED-0001.md: Seed concept specification for Thing, Actor, Relationship, Event, and Knowledge.
- SEMANTIC_DERIVATION_RULES.md: Rules for inheritance and derivation integrity.
- SEMANTIC_GOVERNANCE.md: Lifecycle and governance controls for semantic standards.
- EXTENSION_MODEL.md: Controlled hierarchy for industry and organizational extensions.
- concepts/: Canonical concept sheets using a uniform template.
- relationships/RELATIONSHIP_TEMPLATE.md: Standard template for relationship specifications.
- experiments/EXP-0001_CUSTOMER.md: Validation experiment deriving Customer from the seed.

## Canonical Position

Genesis Business Semantics 1.0 is the canonical semantic foundation for future compiler work.
The seed remains an experimental hypothesis until validated through compiler implementation and enterprise modeling.

## Constraints

- No runtime changes.
- No compiler changes.
- No code generation.
- No ontology expansion beyond the five seed concepts.
- No derived concepts become canonical in this sprint.
