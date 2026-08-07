# 08 Domain Invariants

## Deterministic Invariants

1. Work order references valid Product context.
2. Product BOM remains foreign-owned.
3. requested, planned, completed, rejected, scrap, and rework quantities are coherent by policy.
4. No negative quantities.
5. Operation sequence is acyclic except explicit bounded rework loops.
6. Operation completion prerequisites are satisfied.
7. Material requirement references valid Product and Inventory context.
8. Consumed quantity cannot silently exceed approved policy.
9. Output quantities are coherent with operation and work-order execution state.
10. WIP quantities are coherent and non-negative.
11. One operation execution identity per approved scope.
12. Machine assignment respects capacity and concurrency policy.
13. WorkCenter and ProductionCell relationship is valid and tenant-consistent.
14. Tenant consistency is enforced on all relations and references.
15. External references are tenant-safe.
16. Manufacturing never claims Inventory quantity ownership.
17. No foreign canonical duplication.
18. Idempotency key uniqueness is enforced in tenant command scope.
19. Versions are monotonic.
20. Traceability history is immutable with no destructive rewrite.

## Invariant Enforcement Timing

- command acceptance: idempotency, authority, required references, transition legality
- mutation: quantity coherence, lifecycle coherence, assignment and dependency rules
- persistence: version monotonicity, uniqueness constraints, trace append-only guarantees
- recovery: invariant revalidation before state activation
- projection rebuild: consistency checks for derived state against immutable facts
