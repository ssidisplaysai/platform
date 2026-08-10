# 10 Traceability Service

Service: manufacturing.service.traceability

Behaviors:
- Append-only trace records with per-tenant sequence
- Prevents self-referential edges and duplicate trace IDs
- Converts tenant mismatch in references to TRACE_TENANT_MISMATCH
- Indexes by work order, operation, source, and target
