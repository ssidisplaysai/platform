# 10 External Reference Model

Reference model intent:

- Support cross-platform integration while preserving strict ownership boundaries.

Foreign-owned references:

1. ProductReference
- Owner: Product platform
- Purpose: inventory item linkage
- Mutable in Inventory: no

2. VariantReference
- Owner: Product platform
- Purpose: variant-level stock tracking
- Mutable in Inventory: no

3. OrganizationReference
- Owner: Organization platform
- Purpose: tenant and operational context linkage
- Mutable in Inventory: no

4. DocumentReference
- Owner: Document platform
- Purpose: receiving, quality, compliance attachments
- Mutable in Inventory: no

5. KnowledgeReference
- Owner: Knowledge platform
- Purpose: semantic tags and controlled terminology links
- Mutable in Inventory: no

6. AssetReference
- Owner: Asset platform
- Purpose: equipment/bin handling context where needed
- Mutable in Inventory: no

Reference integrity rules:

1. Inventory stores foreign IDs plus optional denormalized labels for display only.
2. Foreign identity validity checks are integration concerns, not ownership transfers.
3. Inventory cannot define, alter, or lifecycle-manage foreign entities.
4. Missing foreign references are modeled as validation failures at boundary ingress.

Anti-corruption requirement:

- Inventory canonical models must not absorb external lifecycle semantics into Inventory-owned status codes without explicit translation rules.