# EVENT

## Canonical ID

GBS-SEED-EVENT-0001

## Canonical Name

Event

## Version

1.0.0

## Status

Approved

## Semantic Maturity

Approved

## Definition

An observed or asserted occurrence that changes or confirms state over time.

## Purpose

Model temporal change, causality signals, and operational history.

## Parent Concept

None (Seed Primitive)

## Child Concepts

Open for derivation through governance.

## Required Characteristics

- occurrence identity
- time reference

## Optional Characteristics

- initiating actor
- affected things
- outcome indicators

## Allowed Relationships

- involves Actor and Thing
- contextualizes Relationship evolution
- supports Knowledge claims

## Evidence Requirements

Evidence must include time context, source reference, and lineage.

## Compiler Rules

Compiler specifications should preserve ordering and provenance for deterministic auditability.
No implementation rule is introduced by this document.

## Extension Rules

Derived events must preserve temporal semantics and occurrence identity.

## Examples

- order_submitted
- license_approved
- inventory_adjusted

## Historical Notes

Seed concept established in GBS-SEED-0001.

## Revision History

- 1.0.0: Initial approved seed specification.
