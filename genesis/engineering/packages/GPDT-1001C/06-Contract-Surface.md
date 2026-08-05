# 06 Contract Surface

Public contract categories:

1. Commands
- CreateProduct
- UpdateProduct
- PublishProductVersion
- ChangeProductLifecycle
- CreateVariant
- UpdateVariant
- DefineConfiguration
- UpdateConfigurationRule
- DefinePricing
- DefineBOM
- CreateBundle
- CreateKit
- RegisterReference

2. Queries
- GetProductById
- ListProductsByCategory
- GetVariantById
- GetConfigurationById
- GetPricingDefinitionById
- GetBomDefinitionById
- GetBundleById
- GetKitById
- ListReferencesByProduct

3. Events (conceptual)
- ProductCreated
- ProductLifecycleChanged
- VariantCreated
- ConfigurationChanged
- PricingDefinitionUpdated
- BundleCreated
- ProductRetired

4. Reference contracts
- AssetReferenceContract
- DocumentReferenceContract
- KnowledgeReferenceContract
- OrganizationReferenceContract

5. Observation contracts
- ProductHealthProjection
- ProductMetricsProjection
- ProductAuditProjection

Internal contracts:

1. ProductStorePort
2. VersionStorePort
3. ReferenceStorePort
4. AuditStorePort
5. IdentityPort
6. AuthorizationPort
7. OrganizationPort
8. AssetPort
9. DocumentPort
10. KnowledgePort

Contract rules:

1. Version every public contract surface.
2. Distinguish command/query/event/reference/observation semantics.
3. Forbid ownership transfer through contract payloads.
