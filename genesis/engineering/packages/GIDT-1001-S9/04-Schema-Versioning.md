# 04 Schema Versioning

Slice 9 uses an explicit Inventory persistence schema version and fails closed on unsupported versions.

The validator checks the actual Inventory envelope shape, not a generic payload envelope. Unknown versions are rejected during recovery before READY.
