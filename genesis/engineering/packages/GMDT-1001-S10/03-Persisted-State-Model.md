# 03 Persisted State Model

Manufacturing persisted state is Manufacturing-owned.

Top-level envelope:
- manifest
- runtimeState
- tenants

Tenant partitions persist canonical collections for:
- work orders, runs, batches
- routings and operations
- material requirements, issue/return/consumption records
- production outputs, scrap, rework, WIP
- work centers, production cells, assignments
- downtime and execution exceptions
- trace records
- idempotency maps

Runtime state persists:
- audit event stream snapshot
- audit sequence
- reference validation metrics and last-status map
