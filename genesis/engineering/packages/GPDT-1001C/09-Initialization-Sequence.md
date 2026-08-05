# 09 Initialization Sequence

Deterministic startup sequence:

1. Resolve runtime configuration.
2. Construct integration ports.
3. Construct persistence ports.
4. Register core provider(s).
5. Validate provider registry uniqueness.
6. Load persisted Product-definition state.
7. Validate state schema and invariants.
8. Initialize domain services.
9. Initialize query, audit, health, metrics projections.
10. Expose runtime façade singleton.

Startup invariants:

1. Missing critical configuration -> fail closed.
2. Invalid persisted schema/invariant violation -> fail closed.
3. Duplicate provider registration -> fail closed.
4. Partial service graph initialization -> fail closed.

Shutdown sequence:

1. Drain in-flight operations.
2. Flush audit projections.
3. Close persistence/integration resources.
4. Mark runtime state as stopped.

Restart behavior:

1. Reload persisted state deterministically.
2. Recompute health and metrics snapshots.
3. Preserve version and lifecycle continuity.
