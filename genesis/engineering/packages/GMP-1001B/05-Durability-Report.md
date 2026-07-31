# Durability Report

## Durable State Added

1. Pending queue state persisted.
2. Retry state persisted.
3. Dead-letter queue persisted.
4. Audit records persisted.
5. Metrics persisted.

## Restart Behavior

- Startup loads persisted state.
- Pending messages remain in durable store until delivered.
- Subscription registration triggers pending replay for topic.
- Operational readiness derives queue/retry/dead-letter depth from persistence.

## Durability Constraints

- Canonical hardening uses file-backed persistence as internal baseline.
- No external broker required.
- Multi-node execution still depends on future shared transport implementation, but data durability and recovery pathways are now explicit and test-covered.
