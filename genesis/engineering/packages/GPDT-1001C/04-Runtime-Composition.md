# 04 Runtime Composition

Composition root responsibilities:

1. Construct dependency ports.
2. Construct persistence adapters through interfaces.
3. Construct domain services.
4. Construct query and audit projections.
5. Wire health and metrics collectors.
6. Expose runtime façade.

Runtime façade components:

1. commands
- Product mutation use cases.

2. queries
- Product read-model queries.

3. observability
- Health, metrics, and audit snapshots.

4. lifecycle management
- startup/shutdown coordination hooks.

Singleton behavior:

1. One process-level runtime singleton per deployment instance.
2. Singleton creation is lazy and idempotent.
3. Singleton initialization fails closed on missing critical dependencies.

Provider registration model:

1. Register core provider: product-foundation-provider.
2. Register optional providers by capability (analytics projection, AI observation).
3. Reject duplicate provider identifiers deterministically.
4. Preserve provider neutrality through interface contracts.

Dependency graph (high level):

- RuntimeFacade
  - ProductCatalogService
  - VariantService
  - ConfigurationService
  - PricingDefinitionService
  - BomDefinitionService
  - RelationshipService
  - BundleKitService
  - ReferenceRegistryService
  - ProductQueryService
  - ProductAuditService
  - HealthService
  - MetricsService
