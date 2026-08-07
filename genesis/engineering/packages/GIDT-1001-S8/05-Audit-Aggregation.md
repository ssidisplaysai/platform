# 05 Audit Aggregation

Implemented InventoryAuditService:
- wraps audit sink and captures immutable inventory audit events
- read-only query/filter by tenant/entity/action/correlation
- deterministic ordering by recordedAt then event id
- summary counts
- append-only guardrails (mutation/deletion prohibited)

Audit remains distinct from movement ledger history.
