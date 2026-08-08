# 01 Slice Scope

In scope:
- Validate Product, Variant, Product Version, and Product BOM references for a work order baseline using bounded Product integration.
- Freeze validated baseline so downstream requirements are tied to immutable product context.
- Derive deterministic material requirements from BOM lines and work order planned quantity.
- Enforce routing-step existence for each BOM requirement reference.
- Expose material requirement and readiness query surfaces.

Out of scope:
- Inventory reservation and allocation workflows.
- Material issue, return, and reconciliation event pipelines.
- Production output posting and cost finalization.
- Persistent storage contracts and migration strategy.
