# Genesis Commerce Platform Inventory Location Model

## Location Contract
Inventory locations include:
1. locationId, organizationId, and stable identity metadata.
2. locationCode and display naming fields.
3. locationType and enabled/lifecycle metadata.
4. Optional parentLocationId for hierarchy composition.
5. Site and operational scope references.
6. Capacity/handling metadata and notes.
7. Created and updated timestamps.

## Hierarchy Validation Rules
1. Parent location must exist when provided.
2. Self-parenting and cyclic parent chains are rejected.
3. Cross-organization hierarchy links are rejected.
4. Invalid hierarchy submissions return validation violations.

## Bounded Behavior
1. Location hierarchy is validated via deterministic in-process validation.
2. Location configuration is fixture-backed within package boundaries.
3. No external facility master authority migration is performed.
