# Replay Specification

## Normative Replay Contract
A conforming compiler MUST support deterministic replay of required outputs for identical replay inputs.

## Normative Replay Inputs
Replay inputs MUST include:
- evidence references
- canonical entities and relationships
- validated facts
- rule results and rule versions
- compiler version
- specification version
- compiler manifest
- replay manifest

## Normative Replay Requirements
- Replay MUST reproduce required normative outputs.
- Replay MUST preserve output identifiers for deterministic fields.
- Replay MUST preserve ledger and manifest lineage references.
- Replay failures MUST emit immutable diagnostics suitable for certification review.

## Informative Guidance
Replay execution environment may differ if normative output equivalence is preserved.
