# GCS-0001 Conformance Report

## Scope of Conformance
This package provides deterministic runtime conformance for canonical relationship records and relationship registry behavior.

## Mapped GCS Domains
- Determinism: stable identity and linkage derivation from canonicalized inputs.
- Immutability: relationship records and registry records are immutable snapshots.
- Provenance: relationship outputs preserve source provenance linkage.
- Lineage: relationship outputs preserve deterministic lineage chaining.
- Replay: relationship outputs preserve deterministic replay linkage.
- Validation: explicit validator pass/fail semantics with deterministic exception capture.

## Scope Clarifications
- This package implements relationship runtime contracts, creation, and registry behavior only.
- It does not implement business rules, genome assembly, persistence, scheduling, orchestration, deployment, AI/LLM, inference, or conflict resolution authority.

## Conformance Statement
GCI-P2-0003 conforms to the GCS-0001 subset applicable to deterministic relationship runtime foundations and does not claim conformance for excluded runtime domains.
