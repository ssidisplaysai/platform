# 12 Audit Trail Behavior

Slice 3 services emit audit events for:
- Accepted command mutations.
- Rejected commands due to validation/lifecycle/idempotency constraints.

Audit payloads are deterministic and include correlation and version context suitable for traceability.
