# 01 Slice Scope

Implemented capabilities:
- Production output command acceptance and deterministic replay behavior.
- Scrap recording with optional inventory write-off orchestration.
- Rework recording constrained by routing-defined rework edges.
- Yield projection for work-order and operation scopes.
- WIP state projection and deterministic reconciliation rules.

Not implemented in this slice:
- Persistence layer and API transport.
- Resource scheduling, labor accounting, and downtime capture.