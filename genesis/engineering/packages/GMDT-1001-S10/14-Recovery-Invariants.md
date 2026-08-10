# 14 Recovery Invariants

Implemented recovery validation covers:
- unique work-order ids and tenant-scoped numbers
- valid work-order lifecycle and non-negative quantities
- product baseline state coherence
- unique routing ids and operation ids
- routing predecessor/successor integrity and cycle rejection
- material requirement identity and quantity validity
- output/work-order/operation relationship validity
- unique WIP per work order
- assignment relationship integrity
- trace uniqueness and local reference integrity
- idempotency key uniqueness
