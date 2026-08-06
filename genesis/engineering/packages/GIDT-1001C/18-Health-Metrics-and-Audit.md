# 18 Health Metrics And Audit

Health model dimensions:

1. Runtime lifecycle health.
2. Persistence health.
3. Reference validator health.
4. Invariant compliance health.
5. Projection health.
6. Observation publication health.

Metrics taxonomy:

1. inventory.commands.accepted
2. inventory.commands.rejected
3. inventory.concurrency.conflicts
4. inventory.idempotency.duplicates
5. inventory.movements.applied
6. inventory.movements.rejected
7. inventory.reservations.active
8. inventory.allocations.active
9. inventory.low_stock.count
10. inventory.expired_stock.count
11. inventory.quarantined_stock.count
12. inventory.recovery.attempts
13. inventory.recovery.failures
14. inventory.references.failed

Audit evidence taxonomy:

1. command-intent
2. command-validation-result
3. mutation-commit-result
4. mutation-rejection-reason
5. recovery-start
6. recovery-complete
7. recovery-failure
8. health-degradation
9. health-restoration
10. observation-publication-failure

Audit strictness policy:

1. Regulated mutation commands default to fail closed when audit write fails.
2. Non-regulated commands may use degraded mode by explicit policy with alerting.

Health threshold policy examples:

1. reference failed ratio above threshold marks degraded.
2. persistence write failure any occurrence marks critical.
3. recovery failure marks critical and startup blocked.
4. observation publication backlog above threshold marks degraded.

Mission Control posture:

- Mission Control consumes health, metrics, and audit observations only; no mutation authority is granted.