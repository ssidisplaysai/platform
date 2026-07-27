# GEA-0004 Recovery Framework

## Recovery Objectives
- Provide deterministic recovery path after execution failure.
- Preserve immutable lineage and compensation evidence.
- Avoid destructive mutation of prior state records.

## Components
- Retry policy per workflow step with bounded attempts.
- Compensation action registry for failed or rolled-back stages.
- Recovery command to transition failed execution into recovering lifecycle state.
- Snapshot persistence through transition boundaries.

## Failure and Compensation
- Failed stages capture compensation metadata:
  - reversibility,
  - action type,
  - status,
  - reason.
- Recovery reuses persisted execution context and timeline history.

## Operational Notes
- Recovery remains infrastructure-level and intentionally avoids business-domain compensators.
