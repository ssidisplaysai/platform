# 22 Observability and Mission Control

Manufacturing publishes read-only observations only.

Observation content may include:
- readiness
- health
- metrics
- Work Order summaries
- execution-state summaries
- throughput
- WIP
- downtime
- yield
- failure reason codes

Mission Control constraints:
- may not create, release, start, stop, or close work orders
- may not execute operations
- may not issue or consume material
- may not assign machines or labor
- may not mutate routing or exception state

Observability domains:
- runtime
- persistence
- recovery
- Product integration
- Inventory integration
- Work Order invariants
- routing integrity
- operation integrity
- material requirement integrity
- traceability integrity
- idempotency
- concurrency
- resource assignment
- audit and observation sinks
