# Genome Replay

## Purpose
Define deterministic replay requirements for Business Genome assembly.

## Replay Contract
Replay SHALL reproduce assembled genome outputs exactly when replay inputs are identical.

## Required Replay Inputs
- Assembly operation identifier
- Assembly version
- Compiler execution reference
- Compiler version
- Canonical entities
- Canonical relationships
- Validated facts
- Rule results
- Ledger references
- Compiler manifest
- Replay manifest

## Replay Guarantees
Replay SHALL reproduce:
- Snapshot outputs
- Delta outputs
- Graph outputs
- Manifest outputs
- Integrity validation outcomes
- Publication-state eligibility outcomes

## Replay Failure Conditions
Replay SHALL fail certification when:
- Inputs differ from declared replay manifest
- Required references are missing
- Version context is inconsistent
- Output differs from certified baseline replay

## Replay Identifier Governance
Every assembly and publication result SHALL include a replay identifier binding replay-critical inputs and outputs.
