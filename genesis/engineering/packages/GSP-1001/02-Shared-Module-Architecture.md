# 02 Shared Module Architecture

Implemented module layout:

1. contracts/
- Base platform contracts, identifiers, lifecycle primitives, shared error shell.
2. runtime/
- RuntimeHost
- LifecycleManager
- ServiceRegistry
- ProviderRegistry
3. persistence/
- FileStore
- PersistenceCoordinator
- SchemaValidator
- RecoveryCoordinator
4. observability/
- HealthService
- MetricsService
- AuditService
5. mission-control/
- ObserverRegistry
- ObservationPublisher
6. validation/
- InvariantEngine
- CommonValidators
7. testing/
- In-memory store utility
- fixed clock helper
8. utilities/
- deterministic helpers
- version helpers
- normalization helpers

Architecture posture:

- Shared framework is implementation infrastructure only.
- Shared framework does not own any business domain.
