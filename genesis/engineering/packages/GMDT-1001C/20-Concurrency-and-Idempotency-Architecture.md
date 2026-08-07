# 20 Concurrency and Idempotency Architecture

Concurrency model:
- optimistic concurrency is default across Work Order, Routing, Operation, Material Requirement, Output, Assignments, WIP, Downtime, and Trace mutations
- expected-version checks are required on mutating commands
- stale writes are rejected deterministically
- no silent last-write-wins behavior is allowed

Idempotency model:
- tenant-scoped idempotency keys are required for command surfaces
- same key plus same payload is replay-safe
- same key plus conflicting payload is rejected deterministically
- restart preserves idempotency semantics because idempotency records are durable

Duplicate command detection:
- based on idempotency key, tenant, command type, and target identity
