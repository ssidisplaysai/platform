# 05 Runtime Composition

Composition root:

- src/platform/inventory/runtime is the only module authorized to wire process-level dependencies.

Composition layers:

1. Shared mechanical layer
- RuntimeHost
- LifecycleManager
- ServiceRegistry
- ProviderRegistry

2. Inventory infrastructure layer
- File-backed state adapter selection
- Persistence coordinator wiring
- Schema validator wiring
- Recovery coordinator wiring

3. Inventory domain services layer
- Command handlers, query handlers, services, repositories, validators

4. Observability layer
- Health contributors
- Metrics emitters
- Audit record adapters
- Mission Control observation publishers

Runtime composition rules:

1. Domain modules must not directly instantiate shared runtime primitives.
2. Composition root injects dependencies through interfaces.
3. Foreign reference validators are registered through integration adapters.
4. ServiceRegistry hosts service lifecycle and discovery.
5. ProviderRegistry hosts external validator providers and projection providers.

Consistency boundaries in composition:

1. Movement + ledger + balances coordinated via PersistenceCoordinator transaction unit.
2. Reservation and allocation coordination through explicit service orchestration, never implicit projection writes.
3. Projections subscribe to canonical events and rebuild on startup.

Prohibited composition patterns:

1. Runtime layer containing business rules.
2. Domain layer bypassing persistence abstractions.
3. Cross-module global mutable state without repository ownership.
4. Shared component extension by copying shared internals into Inventory.