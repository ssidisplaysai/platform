# GED-0001 Lifecycle Framework

## Purpose
Each entity is assigned a canonical lifecycle preset that controls allowed state transitions.

## Presets
1. Master data: Draft -> Active -> Suspended -> Archived.
2. Transactional: Draft -> Active -> Closed / Cancelled -> Archived.
3. Operational: Draft -> Scheduled -> Active -> Completed -> Archived.
4. Artifact: Draft -> Reviewed -> Approved / Rejected -> Archived.
5. Decision: Proposed -> Reviewed -> Approved / Rejected -> Archived.
6. Event: Pending -> Emitted -> Consumed -> Archived.
7. Measurement: Draft -> Active -> Superseded -> Archived.
