# 03 Service Catalog

Service definitions (conceptual):

1. ProductCatalogService
- Responsibilities: create/update/product lifecycle/version operations.
- Inputs: Product commands.
- Outputs: Product snapshots and domain events.

2. VariantService
- Responsibilities: manage ProductVariant definitions and attribute bindings.
- Inputs: Variant commands.
- Outputs: Variant snapshots and domain events.

3. ConfigurationService
- Responsibilities: manage Configuration and ConfigurationRule definitions.
- Inputs: configuration commands.
- Outputs: configuration snapshots and validation outcomes.

4. PricingDefinitionService
- Responsibilities: manage PricingDefinition versions and effective ranges.
- Inputs: pricing commands.
- Outputs: pricing definition snapshots and version events.

5. BomDefinitionService
- Responsibilities: manage BillOfMaterialDefinition structures and versions.
- Inputs: BOM commands.
- Outputs: BOM snapshots and structural validation outcomes.

6. RelationshipService
- Responsibilities: manage ProductRelationship taxonomy.
- Inputs: relationship commands.
- Outputs: relationship snapshots and events.

7. BundleKitService
- Responsibilities: manage ProductBundle and ProductKit structures.
- Inputs: bundle/kit commands.
- Outputs: structure snapshots and events.

8. ReferenceRegistryService
- Responsibilities: manage Asset/Document/Knowledge/Organization references.
- Inputs: reference commands.
- Outputs: reference snapshots and validation decisions.

9. ProductQueryService
- Responsibilities: compose query views across Product aggregates.
- Inputs: query contracts.
- Outputs: read models for consumers.

10. ProductAuditService
- Responsibilities: emit audit records for domain mutations.
- Inputs: mutation traces.
- Outputs: auditable event records.

Service boundary rules:

1. Services mutate only Product-owned aggregates.
2. Services consume external canonical state by contract references only.
3. Services never own foreign execution state.
