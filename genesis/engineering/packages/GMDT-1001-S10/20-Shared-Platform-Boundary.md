# 20 Shared Platform Boundary

Shared mechanics reused:
- deterministic string ordering helpers
- shared runtime host/lifecycle/observer infrastructure
- semantic use of stable service composition patterns already certified in Shared

Manufacturing-owned semantics retained:
- persisted-state envelope shape
- tenant partition structure
- structural manifest validation
- domain invariant recovery validation
- command durability wrapping strategy

Why this is not a duplicate Shared framework:
- no new generic abstraction was added to Shared
- no cross-platform envelope was imposed
- Manufacturing-specific recovery rules differ materially from Inventory and remain domain-owned

Future extraction criteria:
- repeated evidence across multiple platforms showing identical safe-write, envelope, recovery, and durability semantics with no domain-specific divergence
