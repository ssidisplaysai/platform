# 02 Module Architecture

Proposed runtime module topology:

1. contracts
- Public command/query/event/reference contracts.
- Internal service interfaces and DTO schemas.

2. domain
- Aggregate and entity policies from GPDT-1001B.
- Invariant and lifecycle transition rules.

3. services
- ProductCatalogService
- VariantService
- ConfigurationService
- PricingDefinitionService
- BomDefinitionService
- RelationshipService
- BundleKitService
- ReferenceRegistryService

4. persistence
- ProductStore interface
- VersionStore interface
- ReferenceStore interface
- AuditStore interface
- Concrete adapters defined later during implementation.

5. integration
- Dependency ports for Identity, Authorization, Organization, Asset, Document, Knowledge, Workflow, Messaging, Notification.
- Optional ports for Scheduling, AI observation, Analytics projection.

6. runtime
- Composition root, singleton construction, initialization sequencing, health/metrics projection.

7. observability
- Audit projection builder.
- Metrics snapshot assembler.
- Health check orchestration.

Module dependency direction:

- contracts <- domain <- services <- runtime
- persistence and integration are injected through ports into services/runtime.
- observability depends on runtime service outputs and audit metadata only.

Boundary constraints:

1. No cross-module direct persistence bypass.
2. No module may import foreign platform internals.
3. All external dependencies are consumer-only through contracts.
