# 23 Engineering Guidance

This section defines implementation guidance only. No implementation is performed in GMDT-1001B.

## Contracts

- define bounded Manufacturing contracts with strict ownership boundaries
- keep Product and Inventory interaction contract-first and reference-based

## Domain

- implement aggregates and invariants exactly as defined in this package
- avoid anemic models for lifecycle and quantity integrity

## Services

- separate command and query responsibilities
- keep domain authority in Manufacturing domain services only

## Commands

- command handlers require authority, idempotency, expected version, and audit context

## Queries

- query projections remain read-only views of canonical execution facts

## Persistence

- persist aggregate state and immutable fact streams with recovery invariants
- never bypass invariant checks during rehydration

## Runtime

- consume shared runtime infrastructure without duplicating Shared capabilities

## Product Integration

- consume Product definitions and versioned references
- do not replicate Product canonical records

## Inventory Integration

- use bounded contract flows for reservation, allocation, movement intent, consumption confirmation, returns, and receipts
- never mutate Inventory stock directly

## External References

- store stable foreign identifiers only
- enforce tenant-safe and auditable reference validation

## Traceability

- all critical mutations produce immutable trace links
- preserve compensating correction history

## Concurrency and Idempotency

- use optimistic concurrency and deterministic stale-write rejection
- enforce command idempotency with duplicate and conflict handling

## Observability and Mission Control

- publish observations for monitoring only
- do not permit mission-control channels to mutate manufacturing state

## Recovery

- fail closed on invariant violations
- require deterministic revalidation before enabling command acceptance

## Testing

- future implementation work must include bounded unit, integration, invariant, recovery, concurrency, and idempotency tests aligned to this domain model

## Decision Gate

Manufacturing Runtime Blueprint work may begin only after this domain model is approved.
