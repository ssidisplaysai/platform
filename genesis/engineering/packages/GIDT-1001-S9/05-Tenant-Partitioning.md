# 05 Tenant Partitioning

Persistence is partitioned by tenant ID.

Each tenant writes to its own persisted partition, and recovery restores partitions in deterministic tenant order. Cross-tenant references are rejected by recovery validation rather than silently repaired.
