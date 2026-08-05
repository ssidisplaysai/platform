# 04 Provider and DI Model

Dependency injection model:

1. Runtime accepts explicit dependencies through options.
2. Default dependency set is created when not supplied.
3. Provider registry is dependency-owned and runtime-observable.

Provider registration model:

1. Provider identity is unique by providerId.
2. Duplicate registration is rejected.
3. Provider list is surfaced in observability metadata.

Foundation provider baseline:

- knowledge-foundation-provider is registered by default.
