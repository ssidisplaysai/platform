# 18 Inventory-Specific Manifest Validation

Shared persistence mechanics are reused for the file and coordination pattern, but Inventory owns validation of its own persisted-state envelope.

Why Shared could not be used directly:
- the shared validator assumes a different top-level persisted shape
- Inventory persists a manifest plus tenant partitions, not a generic schemaVersion/payload wrapper
- the Inventory schema must validate tenant IDs, partition structure, and domain-specific recovery invariants
- silently coercing the Inventory envelope into the shared shape would hide real corruption and violate fail-closed recovery

Why this is appropriate:
- it is platform-specific validation, not duplicated business logic
- it keeps Shared generic and certified for its own envelope shape
- it allows future platforms to reuse the same coordination pattern while owning their own persisted state model

Evidence that would justify a future Shared abstraction change:
- multiple platforms with the same persisted top-level envelope shape
- repeated duplication of the same envelope validator logic
- a stable shared manifest contract with no platform-specific structural differences

This is the first consumer of the pattern, so it is not sufficient evidence for a new generic abstraction today.