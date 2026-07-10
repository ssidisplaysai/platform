# GBS 1.0

Status: Approved
Classification: Genesis Standard
Type: Foundational Specification

## Purpose

GBS 1.0 defines the minimal semantic foundation for Genesis.
Its purpose is to establish stable primitives, derivation discipline, and governance controls that allow deterministic and auditable semantic growth.

## Scope

GBS 1.0 governs:
- seed semantic primitives
- canonical semantic identity and lifecycle
- derivation and inheritance constraints
- governance, review, and promotion controls

GBS 1.0 does not define:
- runtime implementation behavior
- compiler implementation details beyond compatibility constraints
- domain-specific ontology expansion

## Design Principles

The semantic seed must be:
- Minimal
- Universal
- Deterministic
- Implementation Independent
- Extensible
- Scientifically Validatable

## Canonical Concept Rule

A concept is canonical only when:
- it has a stable canonical ID
- it is derivable from one or more approved seed concepts
- its semantics pass governance and evidence requirements
- its status is promoted through the defined lifecycle

No concept is canonical by usage frequency or organizational preference.

## Semantic Stability Policy

- Canonical IDs are immutable.
- Canonical meaning may be clarified but not silently redefined.
- Breaking semantic changes require a new major version.
- Deprecated semantics remain documented with migration guidance.

## Semantic Maturity Model

1. Draft
2. Experimental
3. Candidate
4. Approved
5. Canonical
6. Deprecated
7. Archived

Maturity reflects evidence quality, verification depth, and governance approval state.

## Semantic ID Standard

Canonical IDs follow this structure:
GBS-{LAYER}-{CONCEPT}-{SEQUENCE}

Examples:
- GBS-SEED-THING-0001
- GBS-SEED-ACTOR-0001

Rules:
- IDs are unique and immutable.
- ID assignment occurs at Draft stage.
- ID reuse is prohibited.

## Governance Model

Semantic governance is defined in SEMANTIC_GOVERNANCE.md and includes:
- proposal lifecycle
- review and approval gates
- evidence and compatibility requirements
- deprecation and archival controls

## Extension Model

Extension hierarchy is defined in EXTENSION_MODEL.md:
GBS Core -> Industry Extensions -> Organization Extensions -> Local Extensions

Core remains intentionally minimal and stable.
Extensions may add semantics but cannot violate core rules.

## Relationship to the Genesis Constitution

GBS 1.0 is subordinate to the Genesis Constitution and First Principles.
Where conflict exists, constitutional doctrine prevails.
GBS provides semantic formalization for constitutional constraints on truth, evidence, and lineage.

## Relationship to Compiler Specifications

GBS 1.0 constrains future compiler specifications by defining semantic invariants.
Compiler specifications may operationalize semantics, but they may not redefine canonical semantic meaning.
Any compiler-semantic mismatch requires governance review and resolution through standards updates.
