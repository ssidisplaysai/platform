# GOP-0002 Milestone

## Scope

GOP-0002 operationalizes the GOP foundation by wiring live module discovery, durable job events, and a generic inspector host without breaking GLW behavior.

## Delivered

- runtime module bootstrap and validation pipeline
- registry-driven shell navigation
- additive event store schema and repository
- idempotent event ingestion and ordered replay
- GLW lifecycle event adapter
- GOP inspector host entry point
- inspector extension registration surface
- metrics derived from persisted events
- GOP events and metrics API routes
- focused GOP tests

## Compatibility commitments

The milestone preserves:

- GLW authentication
- protected routing
- existing page generation flow
- callback behavior and secrets
- GlwJob persistence model
- n8n integration
- shell theme and core workspace interaction

## Migration

Migration: `20260726000100_gop_job_event_store`

Type: additive

Changes:

- create `GopJobEvent`
- add append/replay indexes
- add unique `(jobId, sequence)` ordering
- add partial unique index for `(jobId, idempotencyKey)` when key is present

Rollback note:

1. disable GOP event writes in runtime dependencies
2. confirm no active consumers of GOP events
3. apply explicit rollback migration to drop `GopJobEvent`

## Known constraints

- module bootstrap uses deterministic registration list, not filesystem discovery
- inspector extension authorization uses current module-level filtering hooks and should be expanded with role-based policy integration in GOP-0003
- full repository `tsc` remains noisy due to unrelated template artifacts under tools/genesis/templates

## GOP-0003 recommendation

- first-class role/permission resolver integrated into module loader and inspector extension gating
- platform event subscriptions and notification fan-out
- shell-level module workspace selector driven by registry metadata
- event-backed dashboards replacing module-local metric reducers
