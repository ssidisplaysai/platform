# 03 Persistence Architecture

Design summary:
- Introduced WorkflowPersistenceCoordinator abstraction with typed stores for each workflow state domain.
- Implemented file-backed store layer using a unified JSON state model.

Persisted domains:
- Definitions
- Instances
- Checkpoints
- Execution history
- Retry records
- Timeout records
- Compensation records
- Audit records
- Metrics snapshot
- Command idempotency records

Consistency strategy:
- Single-writer update semantics per process.
- Optimistic concurrency for instance updates through expected version checks.
- Deterministic append/update operations for history-like streams.

Failure behavior:
- Context persistence errors surfaced as explicit workflow errors.
- Audit persistence failures counted as observability warnings without dropping core state progression.

Operational implication:
- Workflow engine no longer relies solely on in-memory state for runtime correctness.