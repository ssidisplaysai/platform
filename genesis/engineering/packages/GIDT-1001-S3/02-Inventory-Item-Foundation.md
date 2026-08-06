# 02 Inventory Item Foundation

Implemented behavior:

1. register Inventory Item
2. validate tenant-scoped Product and optional Product Variant reference through registered validator
3. enforce unique Inventory Item identity
4. enforce unique Product reference mapping per tenant and variant scope
5. enforce immutable published identifier on metadata updates
6. enforce lifecycle transitions with expected-version checks
7. retrieve Inventory Item
8. list Inventory Items deterministically
9. emit accepted and rejected audit evidence
10. update approved metadata only

Boundary preservation:

1. Product definitions remain foreign-owned.
2. Product name, attributes, configuration, pricing, and BOM data are not copied into Inventory.
3. Inventory stores only Product-owned identifiers plus bounded Inventory metadata.