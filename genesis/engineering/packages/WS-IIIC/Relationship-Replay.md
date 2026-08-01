# Relationship Replay

## Purpose
Define deterministic replay requirements for relationship resolution outcomes.

## Replay Contract
Replay SHALL reproduce relationship decisions exactly when all replay inputs are identical.

## Replay Inputs
Required replay inputs SHALL include:
- Canonical source and target entities
- Relationship evidence set
- Relationship class/type request
- Identity decision dependencies
- Rule set version
- Compiler version
- Business Genome version
- Temporal context
- Replay manifest

## Replay Output Guarantees
Replay SHALL reproduce:
- Relationship decision outcome
- Confidence and authority weight
- Decision rationale reference
- Lifecycle state outcome
- Ledger event sequence

## Replay Failure Rules
Replay SHALL fail certification when:
- Evidence differs
- Version context differs
- Required provenance references are missing
- Rule lineage is incomplete

## Replay Identifier Governance
Each certified relationship decision SHALL reference a replay identifier that binds all replay-critical inputs and outputs.
