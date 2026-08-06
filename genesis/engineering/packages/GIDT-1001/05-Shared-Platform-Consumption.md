# 05 Shared Platform Consumption

Inventory required shared consumption:

1. RuntimeHost
2. LifecycleManager
3. ServiceRegistry
4. ProviderRegistry
5. PersistenceCoordinator
6. SchemaValidator
7. RecoveryCoordinator
8. HealthService
9. MetricsService
10. AuditService
11. ObserverRegistry
12. ObservationPublisher
13. InvariantEngine
14. CommonValidators
15. deterministic utilities
16. semantic-version utilities
17. normalization utilities
18. testing utilities

Consumption boundaries:

1. Shared Platform remains infrastructure only.
2. Inventory consumes Shared; Inventory does not become infrastructure.
3. Inventory shall not modify shared infrastructure ownership semantics.
4. Shared services remain non-authoritative for Inventory domain semantics.
5. Inventory retains canonical authority for Inventory-owned state.

Mission Control interaction:

1. Inventory publishes observations only.
2. Mission Control remains observational only.
3. Mission Control owns no Inventory state.

Conformance rule:

- Any future Inventory design that introduces shared infrastructure ownership by Inventory is out of scope and non-conformant.