# GBS-SEED-0001

Status: Approved
Classification: Genesis Standard
Type: Foundational Specification

## Purpose

This specification publishes the first Genesis Semantic Seed.
It defines the minimal primitive set from which future canonical enterprise semantics may be derived.

## Seed Hypothesis Statement

The Semantic Seed is an experimental hypothesis.
It is subject to validation through compiler implementation and enterprise modeling.
Approval of this document establishes a standards baseline, not final proof of semantic completeness.

## Seed Primitive: GBS-SEED-THING-0001

- Canonical ID: GBS-SEED-THING-0001
- Definition: A Thing is any identifiable unit of reality that can be observed, referenced, and reasoned about.
- Purpose: Provide the universal base semantic for identity-bearing entities.
- Required Characteristics:
- identifiable identity
- observational boundary
- Optional Characteristics:
- attributes
- state
- classifications
- Relationships:
- may participate in Relationship
- may be source or target in Event context
- Compiler Notes: Must support stable identity and deterministic referencing in intermediate representations.
- Evidence Requirements: Existence evidence with source and lineage.
- Extension Rules: Derived concepts must preserve Thing identity semantics.
- Examples:
- person
- organization
- asset

## Seed Primitive: GBS-SEED-ACTOR-0001

- Canonical ID: GBS-SEED-ACTOR-0001
- Definition: An Actor is a Thing capable of intentional action, decision, or responsibility.
- Purpose: Model agency in business reality.
- Required Characteristics:
- identity as Thing
- agency or accountable role
- Optional Characteristics:
- authority scope
- capability profile
- Relationships:
- initiates Event
- participates in Relationship
- Compiler Notes: Must preserve actor attribution for evidence and lineage.
- Evidence Requirements: Evidence of agency, role assignment, or accountable behavior.
- Extension Rules: Derived concepts cannot remove agency semantics.
- Examples:
- customer
- employee
- regulator

## Seed Primitive: GBS-SEED-RELATIONSHIP-0001

- Canonical ID: GBS-SEED-RELATIONSHIP-0001
- Definition: A Relationship is a typed connection between two or more Things with semantic meaning.
- Purpose: Represent structural and contextual connections in reality.
- Required Characteristics:
- source and target reference
- semantic type or meaning
- Optional Characteristics:
- cardinality
- temporal validity
- directionality metadata
- Relationships:
- connects Thing to Thing
- contextualizes Actor participation
- Compiler Notes: Must validate endpoint integrity and preserve relationship lineage.
- Evidence Requirements: Evidence that supports both endpoints and the asserted connection.
- Extension Rules: Derived relationships must not violate parent relationship semantics.
- Examples:
- owns
- reports_to
- supplies

## Seed Primitive: GBS-SEED-EVENT-0001

- Canonical ID: GBS-SEED-EVENT-0001
- Definition: An Event is an observed or asserted occurrence that changes or confirms state over time.
- Purpose: Model temporal change, causality signals, and operational history.
- Required Characteristics:
- occurrence identity
- time reference
- Optional Characteristics:
- triggering actor
- affected things
- outcome markers
- Relationships:
- may involve Actor and Thing
- may establish or modify Relationship context
- Compiler Notes: Must preserve ordering and provenance for auditability.
- Evidence Requirements: Timestamped evidence with source and transformation lineage.
- Extension Rules: Derived events must preserve temporal and occurrence semantics.
- Examples:
- order_submitted
- license_approved
- inventory_adjusted

## Seed Primitive: GBS-SEED-KNOWLEDGE-0001

- Canonical ID: GBS-SEED-KNOWLEDGE-0001
- Definition: Knowledge is an evidence-grounded claim about Things, Actors, Relationships, or Events.
- Purpose: Establish canonical claim semantics tied to evidence and verification.
- Required Characteristics:
- claim statement
- evidence references
- confidence or verification state
- Optional Characteristics:
- counterevidence references
- review history
- Relationships:
- refers to Thing, Actor, Relationship, or Event
- may promote to canonical principle through governance
- Compiler Notes: Must enforce evidence linkage and deterministic lineage propagation.
- Evidence Requirements: Traceable evidence bundle sufficient for verification.
- Extension Rules: Derived knowledge concepts must retain evidence-grounded claim semantics.
- Examples:
- compliance_status claim
- identity_verification claim
- risk_assessment claim

## Constraints

- No ontology expansion beyond the five seed concepts in this sprint.
- No derived concept becomes canonical in this sprint.
- No runtime or compiler behavior changes are authorized by this specification.
