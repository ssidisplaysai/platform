# 18 Downtime and Execution Exception Model

## DowntimeRecord

Required fields:
- downtimeId
- workOrderReference
- operationReference
- workCenterReference
- machineReference
- category
- reason
- start
- end
- duration
- correctiveActionReference
- audit evidence
- version

Rules:
- duration must be deterministic from start and end
- overlapping downtime policy must be explicit
- correction uses compensating records, not destructive rewrite

## ExecutionException

ExecutionException may be modeled as a dedicated entity or classified subtype of exception records with:
- exceptionId
- category
- severity
- source entity reference
- detectedAt
- status
- resolution reference
- audit linkage
- version

Boundary note:
- model is separable from a future Maintenance platform ownership expansion
