# 02 Module Architecture

Module principle:

- Every module exists only if it owns substantive Inventory responsibility.

Public module surfaces and responsibilities:

1. contracts
- Owns command, query, event, and error contracts.
- Exposes DTO-like runtime boundaries without persistence details.

2. domain
- Owns entities, value objects, invariants, lifecycle transitions, and aggregate boundary rules.

3. commands
- Owns command handlers and validation orchestration before service execution.

4. queries
- Owns read-only query handlers over canonical state and derived projections.

5. services
- Owns domain orchestration and transaction boundaries.

6. persistence
- Owns repository abstractions, schema mapping, version tokens, idempotency store, and recovery metadata.

7. projections
- Owns recomputable derived views and projection rebuild orchestration.

8. integration
- Owns foreign reference validators and anti-corruption adapters.

9. runtime
- Owns runtime composition, dependency registration, startup sequence, and lifecycle wiring.

10. health
- Owns inventory runtime health contributors and health classifications.

11. metrics
- Owns inventory metric emission conventions and counters.

12. audit
- Owns audit evidence policy and structured audit record composition.

Internal-only submodules by domain responsibility:

1. inventory-item
2. warehouse
3. location-bin
4. balance
5. movement
6. ledger
7. reservation
8. allocation
9. transfer
10. receiving-putaway
11. picking-packing
12. lot
13. serial
14. expiration
15. reorder-policy
16. reference-validation
17. query-projection

Dependency direction:

1. contracts is dependency root for transport contracts only.
2. domain depends on contracts primitives only where needed.
3. services depend on domain, persistence abstractions, integration adapters, and shared mechanisms.
4. commands depend on services and domain validators.
5. queries depend on projections and read repositories.
6. runtime composes all; it is not imported by domain logic.
7. health, metrics, audit consume service outcomes and runtime events; they do not own business transitions.

Prohibited cross-module access:

1. queries may not mutate canonical state.
2. integration may not bypass services to persist state.
3. health/metrics/audit may not alter domain entities.
4. commands may not write persistence directly.
5. projections may not become canonical source of truth.

Shared integration points:

1. runtime uses RuntimeHost, LifecycleManager, ServiceRegistry, ProviderRegistry.
2. persistence uses FileStore, PersistenceCoordinator, SchemaValidator, RecoveryCoordinator.
3. observability modules use HealthService, MetricsService, AuditService, ObserverRegistry, ObservationPublisher.
4. domain and commands use InvariantEngine, CommonValidators, deterministic and normalization utilities where appropriate.