# 19 Engineering Guidance

Implementation-phase guidance (future work, not in this package):

1. Implement aggregates and value objects as explicit typed models.
2. Enforce all invariants at aggregate boundaries.
3. Use optimistic concurrency with strict version checks.
4. Apply idempotency keys on every external mutation command.
5. Persist immutable ledger entries for every applied movement.
6. Materialize snapshots as derivative views, never replacing ledger truth.
7. Keep reference adapters anti-corruption oriented for foreign platforms.
8. Maintain tenant isolation at every storage/query boundary.
9. Ensure deterministic ordering where ordering impacts behavior.
10. Emit domain events with causation/correlation metadata.
11. Keep Shared usage mechanical; do not push domain semantics down.

Recommended test strategy for later phase:

1. Invariant-focused aggregate tests.
2. Property tests for quantity conservation and non-negativity.
3. Idempotency replay tests.
4. Concurrency conflict tests.
5. Lot/serial uniqueness and traceability tests.
6. Transfer balancing tests.
7. Expiration/quarantine enforcement tests.

Documentation maintenance rules:

1. Update entity and aggregate docs before runtime schema changes.
2. Update invariants and validation checklist when rules evolve.
3. Keep boundary statements synchronized with ownership matrix artifacts.

Scope statement:

- No runtime engineering was performed under GIDT-1001B; this artifact is domain-definition only.