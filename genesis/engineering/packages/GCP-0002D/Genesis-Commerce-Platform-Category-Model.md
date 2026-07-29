# Genesis Commerce Platform Category Model

## Category Contract
Each category record includes:
1. Stable category identity and organization scope.
2. Name, slug, optional description, and sortOrder.
3. Optional parentCategoryId for hierarchy.
4. Status lifecycle (active, suspended, archived).
5. Site assignment references.

## Hierarchy Rules
1. Parent category must exist.
2. Cycles are rejected.
3. Category hierarchy validation is deterministic and explainable.
