# 06 Deterministic Query Surface

Implemented ManufacturingFoundationQueryService.

Capabilities:
- Deterministic get/list queries for work orders, runs, and batches.
- Query by tenant, work order, and run linkage constraints.
- Read-only execution-state query projection.

Sorting and projection behavior is deterministic to support stable automation and evidence capture.
