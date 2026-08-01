# WS-IIIC Relationship Resolution Engine

## Purpose
Define the constitutional architecture that resolves how canonical entities are connected.

## Boundary
Entity Resolution answers: What is this entity?
Relationship Resolution answers: How are resolved entities connected?

Relationship Resolution SHALL be independent from Entity Resolution while remaining provenance-linked to identity decisions.

## Constitutional Invariants
1. Relationship decisions SHALL be evidence-backed.
2. Identical governed inputs SHALL produce identical relationship outputs.
3. Relationship records SHALL be immutable and append-only.
4. Relationship state transitions SHALL be lifecycle-governed.
5. Every relationship decision SHALL be replay-verifiable.
6. Every relationship decision SHALL be certifiable through independent review.

## Relationship Domains
WS-IIIC SHALL support deterministic handling for:
- Ownership
- Employment
- Reporting
- Supplier
- Customer
- Manufacturer
- Distributor
- Integrator
- Installer
- Partner
- Subsidiary
- Parent
- Location
- Asset Assignment
- Equipment Assignment
- Document Reference
- Policy Reference
- Procedure Reference
- Product Composition
- Product Dependency
- Capability
- Risk
- Opportunity
- Project Participation
- Service Relationship
- Approval
- Authorization
- Compliance
- Temporal Relationship
- Hierarchical Relationship
- Network Relationship
- Additional WS-I canonical relationship classes approved by governance

## Decision Model
Each relationship resolution decision SHALL include:
- Source canonical entity
- Target canonical entity
- Relationship class and type
- Supporting evidence set
- Contradicting evidence set
- Applied rule set version
- Compiler version
- Confidence and authority weight
- Decision rationale
- Replay identifier
- Certification status

## Governance Outcome Types
A relationship decision SHALL be one of:
- CONFIRMED
- REJECTED
- SUPERSEDED
- RETIRED
- CONDITIONAL

## Dependency Contract
WS-IIIC depends on:
- WS-I canonical model contract
- WS-II evidence governance contract
- WS-III compiler contract
- WS-IIIA execution governance
- WS-IIIA-R1 intermediate representation governance
- WS-IIIB entity resolution outputs

## Out of Scope
This package SHALL NOT define implementation artifacts.
No storage engines, services, APIs, executable logic, or runtime behavior are specified.
