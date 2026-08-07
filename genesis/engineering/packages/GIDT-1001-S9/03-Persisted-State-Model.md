# 03 Persisted State Model

The persisted Inventory state is an envelope with a manifest and tenant partitions.

Manifest fields are explicit:
- schemaVersion
- runtimeId
- tenantIds
- recovery timestamps and reasons

Tenant partitions include foundation records, movement and ledger state, Slice 5 reservation/allocation state, Slice 6 lot/serial/expiration state, and audit evidence.
