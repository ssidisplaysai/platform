# RELATIONSHIP

## Canonical ID

GBS-SEED-RELATIONSHIP-0001

## Canonical Name

Relationship

## Version

1.0.0

## Status

Approved

## Semantic Maturity

Approved

## Definition

A typed connection between two or more Things with semantic meaning.

## Purpose

Represent structural and contextual connections in business reality.

## Parent Concept

None (Seed Primitive)

## Child Concepts

Open for derivation through governance.

## Required Characteristics

- endpoint references
- semantic meaning

## Optional Characteristics

- cardinality
- temporal validity
- directional metadata

## Allowed Relationships

- binds Thing to Thing
- contextualizes Actor interactions
- may be referenced by Knowledge claims

## Evidence Requirements

Evidence must support both endpoints and the asserted semantic connection.

## Compiler Rules

Compiler specifications should enforce endpoint integrity and lineage preservation.
No implementation rule is introduced by this document.

## Extension Rules

Derived relationships must remain additive and may not violate parent semantics.

## Examples

- owns
- reports_to
- supplies

## Historical Notes

Seed concept established in GBS-SEED-0001.

## Revision History

- 1.0.0: Initial approved seed specification.
