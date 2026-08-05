# 02 Architecture

Architecture summary:

1. Service layer encapsulates registry, audit, metrics, and health.
2. Persistence layer enforces deterministic file-backed canonical state.
3. Runtime layer composes dependencies, initializes coordinator, and exposes singleton runtime.
4. Integration layer provides provider registration for foundation capability discovery.

Fail-closed principle:

- Runtime initialization halts when persisted state fails validation or recovery.

Determinism principle:

- Canonical persisted state schema is versioned and validated before runtime usage.
