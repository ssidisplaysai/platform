# GOP-0007 Roadmap Recommendation

## Recommended Milestone Goal

Elevate runtime fabric from process-local coordination with durable projections into a fully durable, horizontally arbitrated distributed scheduler.

## Priority Work

1. Durable queue/lease authority with transaction-safe arbitration.
2. Cross-host lease fencing tokens and strict CAS semantics.
3. Worker protocol streaming pull mode with backpressure.
4. Dead-letter forensics and guided operator recovery flows.
5. Multi-host chaos certification (DB partitions, network splits, host churn).

## Exit Criteria

- No duplicate execution under multi-host arbitration.
- Deterministic lease ownership under partition recovery.
- Observability and SLO coverage for enterprise load.
