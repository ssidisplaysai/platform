# 03 Routing Instantiation

CreateExecutionRouting command includes:
- execution routing id, tenant id, work order id.
- optional source product routing reference and source version references.
- routing steps definition.
- expected work-order version and routing create expected version.
- idempotency key and correlation id.
- command metadata extension point.

Instantiation behavior is deterministic and in-memory for Slice 4.
