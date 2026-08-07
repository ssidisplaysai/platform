# 11 Versioning and Concurrency

## Versioning Model

- ManufacturingWorkOrder version
- OperationExecution version
- ExecutionRouting version
- MaterialRequirement version
- ProductionOutputRecord version
- Assignment entity versions

Rules:
- versions increment monotonically on accepted mutation
- immutable fact entities use append-only correction records instead of destructive edits where applicable
- stale writes are rejected through expected-version checks

## Concurrency Model

- optimistic concurrency as default
- command must include expected version or concurrency token
- mismatch produces deterministic rejection
- no silent last-write-wins

## Idempotency Model

Idempotency required for:
- work-order create/release/start/pause/resume/complete
- operation start/complete
- material issue request
- material consumption
- production output
- scrap and rework recording
- machine and labor assignment

Idempotency rules:
- same key plus same payload: replay-safe response
- same key plus conflicting payload: deterministic reject
- idempotency scope: tenant plus command type plus target identity

## Atomic Command Boundaries

- each aggregate mutation command is atomic within aggregate boundary
- cross-aggregate orchestration uses correlated commands and explicit compensating actions

## Race Handling

- conflicts resolved by reject-and-retry policy with preserved idempotency key
- duplicate command detection and replay-safe outcomes are mandatory
