# 08 Domain Invariants

Identity invariants:

1. Product must always have exactly one canonical identity.
2. ProductVariant must belong to one and only one Product.
3. Business identifiers must be unique within governed scope.

Structural invariants:

1. ProductBundle cannot recursively contain itself.
2. ProductKit cannot recursively contain itself.
3. ConfigurationRule graph cannot contain cycles.
4. BillOfMaterialDefinition graph must remain acyclic.

Version invariants:

1. Pricing definitions must be version-aware.
2. BOM definitions must be version-aware.
3. Configuration definitions must be version-aware.
4. Lifecycle-affecting changes must preserve version lineage integrity.

Reference invariants:

1. External references must remain stable.
2. Foreign canonical records are referenced, never duplicated as Product-owned truth.
3. Mandatory references must fail closed when invalid.

Ownership invariants:

1. No duplicate ownership across Product and external platforms.
2. No ownership transfer through events, adapters, or projections.
3. Compiler and Business Genome authority remains intact.

Boundary invariants:

1. No Inventory quantity ownership.
2. No Manufacturing execution ownership.
3. No Commerce transaction ownership.
4. No CRM customer ownership.
5. No Finance accounting ownership.
