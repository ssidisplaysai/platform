# 01 Slice Scope

Slice 9 delivers durable Inventory persistence and deterministic recovery.

In scope:
- schema-versioned persisted Inventory envelopes
- tenant-partitioned state capture and restore
- durable recovery on runtime startup
- fail-closed corruption handling
- deterministic projections, metrics, and audit recovery

Out of scope:
- new Inventory business capabilities
- HTTP APIs
- Shared Platform reimplementation
- Slice 10 work
