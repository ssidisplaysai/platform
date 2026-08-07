# 12 Shared Platform Consumption

Manufacturing shall consume certified GSP-1001 reusable infrastructure where appropriate, including:
- RuntimeHost
- LifecycleManager
- ServiceRegistry
- ProviderRegistry
- FileStore
- PersistenceCoordinator
- SchemaValidator
- RecoveryCoordinator
- HealthService
- MetricsService
- AuditService
- ObserverRegistry
- ObservationPublisher
- InvariantEngine
- CommonValidators
- deterministic utilities
- semantic-version utilities
- bounded normalization
- shared testing utilities

Boundary constraints:
- Shared remains infrastructure authority
- Manufacturing remains domain execution authority
- this work order does not modify Shared Platform
