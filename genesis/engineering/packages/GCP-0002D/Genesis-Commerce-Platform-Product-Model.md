# Genesis Commerce Platform Product Model

## Product Configuration Contract
Each product record includes:
1. Stable product identity and organization scope.
2. Catalog-facing identity (name, displayName, slug, sku, optional modelNumber).
3. Type/family metadata and category assignments.
4. Manufacturer and brand references.
5. Lifecycle, catalog status, enabled state, and visibility state.
6. Site assignments with per-site publication and profile references.
7. Media/document references represented as opaque IDs only.
8. Ordered specification records with visibility and confidence metadata.
9. Optional Business Genome and evidence references.

## Guardrails
1. Organization reassignment is blocked on update.
2. Duplicate slug and duplicate sku are blocked per organization.
3. Raw secret fields are rejected.
4. Product ID is immutable.
