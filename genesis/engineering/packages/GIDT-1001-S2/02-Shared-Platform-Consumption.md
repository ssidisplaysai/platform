# 02 Shared Platform Consumption

Consumed shared components:

1. RuntimeHost
- used as the root runtime container and lifecycle owner.

2. LifecycleManager
- used for deterministic start ordering and reverse stop ordering.

3. ServiceRegistry
- used to register runtime-only service tokens.

4. ProviderRegistry
- used to register mechanical providers required before ready state.

5. ObserverRegistry
- used only for bounded runtime observation registration surface.

6. deterministic utilities
- used for deterministic ordering of services, providers, lifecycle adapters, and integration adapters.

Shared boundary preservation:

1. No Inventory business semantics moved into shared.
2. No shared runtime mechanics duplicated in Inventory.
3. No shared code was modified.