# GEA-0004 Replay

## Replay Contract
- Replay records persist checksum, determinism classification, external dependency set, and timestamp.
- Replay endpoint returns persisted replay artifacts for execution trace validation.

## Determinism Classification
- DETERMINISTIC:
  - No external runtime dependency required to reproduce replay payload.
- PARTIAL:
  - External dependency present (for example event-driven or calendar scheduling triggers).

## Checksum Inputs
- Canonical workflow identity and definition checksum.
- Execution coordination state by step.
- Retry counters.
- Approval outcomes.
- Delegation map.
- Timeline state/note sequence.

## Outcome
- Repeated replay on unchanged execution state yields stable checksum.
- Divergent external trigger classes are explicitly recorded as non-deterministic dependencies.
