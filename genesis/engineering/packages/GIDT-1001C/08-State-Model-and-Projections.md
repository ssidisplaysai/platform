# 08 State Model And Projections

Canonical state domain:

1. Inventory items.
2. Balances.
3. Warehouses.
4. Locations and bins.
5. Reservations.
6. Allocations.
7. Movements.
8. Ledger entries.
9. Lots.
10. Serials.
11. Expiration records.
12. Reorder and safety policies.
13. Idempotency records.
14. Version and concurrency metadata.

Derived projections domain:

1. Availability by product and scope.
2. Low-stock status.
3. In-transit totals.
4. Expiration and quarantine summaries.
5. Warehouse totals.
6. Location totals.
7. Reservation and allocation totals.
8. Movement summaries.
9. Health summaries.
10. Metrics snapshots.

Separation rules:

1. Canonical state changes only through command-handled domain mutations.
2. Derived projections are read models only.
3. Projection failures do not modify canonical state.
4. Projections are fully rebuildable from canonical state and ledger facts.

Projection update modes:

1. Synchronous critical projections: availability and allocation summaries needed for command-side checks.
2. Asynchronous non-critical projections: dashboards and long-range summaries.

Projection rebuild strategy:

1. Load canonical state.
2. Validate schema and invariants.
3. Replay ledger from checkpoint as needed.
4. Recompute projection views deterministically.
5. Publish projection readiness observation.

Failure handling:

1. Critical projection build failure blocks readiness.
2. Non-critical projection failure marks degraded health and emits audit evidence.
3. Projection divergence detection triggers recovery path and operator alert.

Ownership posture:

- Inventory remains owner of canonical inventory facts; enterprise analytics ownership remains external for cross-domain analytics.