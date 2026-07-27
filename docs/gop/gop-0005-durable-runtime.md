# GOP-0005 Durable Runtime and Execution Persistence

## Goal

Make GOP executions first-class durable platform objects that survive process restarts, support deterministic replay, and enable crash recovery without changing GLW runtime contracts.

## Scope

- Add durable execution and snapshot persistence models.
- Persist execution lifecycle transitions and periodic snapshots.
- Recover in-flight executions on runtime bootstrap.
- Expose persistent execution APIs for list/detail/history/replay.
- Keep existing authorization, callback behavior, and GLW flows unchanged.

## Persistence Model

### Tables

- `GopExecution`
  - Canonical execution record keyed by `executionId`.
  - Optional `jobId` binding to GLW jobs.
  - Durable lifecycle fields: status, state, queue/worker metadata, retry history, timing, artifacts, and versioning.
- `GopExecutionSnapshot`
  - Immutable snapshot stream keyed by `snapshotId`.
  - Ordered by `(executionId, snapshotSequence)`.
  - Stores deterministic reconstruction state including `state`, metrics, timing, and queue/worker details.

### Migration

- Additive migration: `prisma/migrations/20260726093000_gop_execution_store/migration.sql`.
- No destructive SQL and no changes to existing GLW tables.

## Runtime Integration

### Repository

- Runtime uses Prisma-backed `GenesisExecutionRepository` in singleton bootstrap.
- In-memory repository remains available for tests.

### Persistence flow

- Execution transitions call `saveExecution` asynchronously.
- Snapshot created from current execution state and stored with monotonically increasing `snapshotSequence`.
- Snapshot compaction retains latest 60 snapshots per execution by default.

### Recovery flow

On startup (`ensureRecovered`):

- Load recoverable executions from durable store.
- Apply fail-safe policy:
  - `RUNNING` / `DISPATCHED` / `RETRYING` => moved to `WAITING` with manual approval required.
  - `QUEUED` / `SCHEDULED` => re-enqueued to runtime queue.
- Recovery is non-fatal; if persistence is unavailable, runtime remains operational.

## Deterministic Replay

- `snapshot-engine.ts` creates canonical execution snapshots.
- `replay-engine.ts` reconstructs execution state from snapshot baseline and ordered event sequence.
- Replay supports optional sequence cutoff for historical inspection.

## APIs

### Existing endpoint retained

- `GET /api/gop/jobs/:id/execution`
  - Now ensures recovery bootstrap before lookup.

### New durable endpoints

- `GET /api/gop/executions`
  - Query: `workspaceId`, `moduleId`, `status`, `q`, `limit`.
  - Returns durable execution list/search results.
- `GET /api/gop/executions/:id`
  - Returns single execution.
- `GET /api/gop/executions/:id/history`
  - Returns ordered snapshots for an execution.
- `GET /api/gop/executions/:id/replay?sequence=:n`
  - Returns replayed execution state at optional event sequence cutoff.

### Authorization

- Uses existing GLW session requirements.
- Uses existing GOP authorization resolver and job-view checks.
- Default-deny behavior preserved.

## Operational Notes

- Durable calls are guarded with fail-safe fallback to in-memory runtime when persistence is unavailable.
- Recovery runs once per process lifecycle and is idempotent at runtime level.
- `flushPersistence()` can be used in tests or controlled shutdown paths to await outstanding persistence tasks.

## Validation Performed

- Prisma schema validation: passed.
- Migration status: new GOP-0005 migration detected as pending.
- Focused runtime/API tests:
  - `tests/gop/orchestration-runtime.test.ts` passed.
  - `tests/gop/operations-api.test.ts` passed.
- New durability tests added in `tests/gop/execution-durability.test.ts`.

## Follow-up

- Apply migration in target environment: `prisma migrate dev` (development) or `prisma migrate deploy` (production).
- Extend operations center to consume durable execution timeline and replay directly.
- Add endpoint-level tests for new durable execution APIs.
