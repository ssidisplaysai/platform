# GBA-0005 Pipeline Framework

## Pipeline Contract
Each pipeline record includes:
- Account identity and opportunity reference.
- Stage, amount, weighted amount, probability, and expected close date.
- Deterministic immutable lineage.

## Mutation Model
- Read: gba:sales:view_pipeline
- Write: gba:sales:manage_pipeline

## Eventing
Pipeline creation appends timeline events for replay and audit.
