# 26 Test Strategy

This package defines test strategy only. No tests are created here.

Coverage areas for future implementation work:
- domain primitives
- work-order lifecycle
- routing graph and cycle prevention
- bounded rework loops
- operation execution
- material requirement derivation
- Product BOM lineage
- Inventory availability interaction
- reservation and allocation requests
- issue, consumption, output, scrap, and rework
- WIP
- work-center assignment
- machine and labor assignment
- downtime and exceptions
- traceability
- reference validation
- concurrency and idempotency
- persistence and recovery
- corruption handling
- health, metrics, and audit
- Mission Control observations
- Product and Inventory compatibility
- Shared consumption
- negative paths

Mandatory future test cases:
- invalid Product or BOM
- routing structural cycle
- invalid operation sequencing
- stale Work Order version
- duplicate Work Order idempotency
- Inventory reservation failure causes no false Manufacturing state
- Inventory issue failure causes no false consumption
- output receipt failure causes no false stock-complete state
- duplicate consumption replay
- duplicate output replay
- rework trace preservation
- corrupt trace history rejection
- persisted-state corruption
- unsupported schema
- no partial recovery
- deterministic restart
