# Rule Ledger

## Purpose
Define immutable ledger architecture for rule evaluations.

## Ledger Model
The Rule Ledger SHALL be append-only and immutable.
Every evaluation SHALL produce a ledger record.

## Required Ledger Fields
Every evaluation SHALL record:
- Rule
- Inputs
- Evidence
- Relationships
- Entities
- Decision
- Confidence
- Timestamp
- Compiler Version
- Rule Version
- Replay Manifest
- Certification Status

## Ledger Event Types
- RULE_EVALUATED
- RULE_CONFLICT_DETECTED
- RULE_BLOCKED
- RULE_CERTIFICATION_HOLD
- RULE_RESULT_SUPERSEDED
- RULE_RESULT_CERTIFIED

## Immutability Contract
Ledger records SHALL NOT be overwritten or deleted.
Corrections SHALL be represented as appended events with lineage links.

## Audit Contract
Any rule result SHALL be auditable from the ledger using provenance references and version context.
