# Relationship Ledger

## Purpose
Define the immutable ledger architecture for relationship resolution decisions.

## Ledger Model
The Relationship Ledger SHALL be append-only and immutable.
Each entry SHALL represent a governed relationship decision event.

## Required Ledger Fields
Each record SHALL contain:
- Relationship Identifier
- Source Entity
- Target Entity
- Relationship Type
- Supporting Evidence
- Conflicting Evidence
- Decision
- Decision Rationale
- Confidence
- Compiler Version
- Rule Set Version
- Business Genome Version
- Timestamp
- Replay Manifest
- Certification State

## Ledger Event Types
- RELATIONSHIP_CREATED
- RELATIONSHIP_VALIDATED
- RELATIONSHIP_ACTIVATED
- RELATIONSHIP_MODIFIED
- RELATIONSHIP_SUPERSEDED
- RELATIONSHIP_RETIRED
- RELATIONSHIP_CERTIFIED

## Immutability Contract
Ledger records SHALL NOT be overwritten or deleted.
Corrections SHALL be represented as new events with lineage links.

## Replay Contract
Replay SHALL reconstruct relationship state by deterministic event ordering and governed state transition rules.

## Audit Contract
Auditors SHALL be able to trace any active relationship to:
- all supporting and conflicting evidence
- all lifecycle decisions
- all version identifiers
- all certification decisions
