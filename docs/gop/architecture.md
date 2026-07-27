# Genesis Operator Platform

Genesis Operator Platform (GOP) is the reusable job-and-inspection layer that GLW now demonstrates.

## Principles

- Everything is a job.
- Jobs emit events.
- Events form timelines.
- Timelines feed the inspector, logs, notifications, and metrics.
- Applications register capabilities instead of hard-coding platform behavior.

## Stable contracts

The contract layer lives in `src/platform/gop/contracts.ts` and defines:

- Job
- Job Event
- Timeline Entry
- Inspector
- Action
- Artifact
- Metric
- Notification
- Application Module
- Worker
- Execution Context

## Job engine

The generic engine in `src/platform/gop/job-engine.ts` owns:

- terminal status detection
- safe status transitions
- basic progress normalization
- job snapshots for operator views

## Runtime bootstrap flow

The runtime loader lives in `src/platform/gop/runtime/loader.ts` and consumes an explicit bootstrap list from `src/platform/gop/runtime/bootstrap-list.ts`.

Boot sequence:

1. Load deterministic manifests.
2. Validate required fields.
3. Reject duplicate module identifiers.
4. Reject duplicate route ownership.
5. Reject invalid job type declarations.
6. Filter disabled navigation and future permission-gated entries.
7. Emit deterministic ordered navigation for the shell.

Invalid manifests fail safely and are excluded instead of taking down the shell.

## Event store

The durable event store is implemented in `src/platform/gop/event-store.ts` and persisted to `GopJobEvent`.

Event identity and idempotency:

- immutable `eventId`
- deterministic `jobId + sequence` ordering
- optional `idempotencyKey` with duplicate-safe ingestion
- append-only inserts

Replay and summary:

- list events for a job
- list events after sequence
- latest event lookup
- timeline replay
- progress reduction
- terminal-state detection

## Event engine

The event reduction layer in `src/platform/gop/event-engine.ts` converts ordered events into timeline entries and is used by inspector rendering.

## Module registration

The registry in `src/platform/gop/module-registry.ts` allows modules to self-describe:

- name and description
- navigation
- routes
- permissions
- supported job types
- actions
- badges
- metrics

## GLW compatibility

GLW remains the reference implementation.

Compatibility adapters:

- `src/platform/gop/adapters/glw.ts` maps GLW jobs and module registration.
- `src/platform/gop/adapters/glw-events.ts` emits additive lifecycle events during existing GLW job transitions and callbacks.
- `src/platform/gop/adapters/glw-inspector.ts` maps GLW jobs into generic inspector host input and prefers persisted GOP events.

Historical GLW jobs are preserved and can be safely projected/backfilled on read.

## Inspector host

The platform entry point is `src/components/gop/gop-inspector-host.tsx`.

It accepts GOP contracts and renders shared inspector sections (overview, progress, stage, timeline, results, diagnostics).

Optional module-specific sections are supported through `src/platform/gop/inspector/extensions.ts`.

## Metrics derivation

`src/platform/gop/metrics-from-events.ts` calculates operational metrics from persisted events, including:

- jobs created
- jobs started
- jobs completed
- jobs failed
- jobs timed out
- jobs cancelled
- average runtime
- success rate
- failure rate
- active jobs
- queue depth

The API surface is exposed through `src/app/api/gop/metrics/route.ts`.

## Migration strategy

Future Genesis modules should:

1. Register a module manifest.
2. Emit job events instead of mutating timeline state directly.
3. Render the shared inspector contract.
4. Consume shared metrics.
5. Use the shell navigation surface through module registration.

## Migration and compatibility notes

Prisma migration `20260726000100_gop_job_event_store` is additive and creates `GopJobEvent` only.

Rollback note: if rollback is required, revert code paths to ignore GOP events first, then drop `GopJobEvent` in a dedicated rollback migration only after confirming no consumers depend on it.
