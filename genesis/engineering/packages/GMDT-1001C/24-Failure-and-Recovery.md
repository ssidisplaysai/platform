# 24 Failure and Recovery

Deterministic failure classes:
- invalid command
- invalid lifecycle transition
- invalid Product reference
- invalid BOM reference
- invalid Inventory reference
- insufficient Inventory
- Inventory request failure
- routing cycle
- operation prerequisite failure
- material variance violation
- output inconsistency
- WIP inconsistency
- duplicate Work Order
- duplicate operation
- duplicate idempotency key
- conflicting idempotency payload
- stale expected version
- resource assignment conflict
- traceability violation
- corrupt persisted state
- unsupported schema
- persistence failure
- recovery failure
- observation failure

Failure handling policy:
- reject before mutation when command or validation fails
- rollback or compensating fact when post-check failure occurs within an aggregate transaction
- degrade health for dependency or sink failures
- block startup on unrecoverable schema, recovery, or trace failures
- increment metrics for all classified failures
- emit audit for critical failures and state transitions
