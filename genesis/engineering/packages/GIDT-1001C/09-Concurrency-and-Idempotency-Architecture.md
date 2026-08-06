# 09 Concurrency And Idempotency Architecture

Concurrency mechanics:

1. Optimistic concurrency with expected-version checks on every mutable aggregate.
2. AggregateVersion increments exactly once on accepted mutation.
3. Cross-aggregate coordinated updates use PersistenceCoordinator and compare-on-write semantics.
4. Stale writes reject with deterministic conflict codes.

Idempotency mechanics:

1. All mutation commands require idempotency key.
2. Idempotency scope: tenant + command type + authority scope + business key.
3. Stored idempotency record includes payload hash and prior result reference.
4. Duplicate key with same payload returns prior accepted result.
5. Duplicate key with different payload rejects deterministically.

Race-condition handling:

1. Reservation race handled by balance expected-version and reservation atomic decrement.
2. Allocation race handled by reservation remaining-quantity compare-on-write.
3. Serial double assignment race handled by serial aggregate version and unique active-location invariant.
4. Transfer race handled by source and destination coordinated compare-on-write.
5. Balance update race handled by affected-balance set version verification.

Retry-safe behavior:

1. Clients may retry failed-or-timeout commands with same idempotency key.
2. Runtime guarantees no duplicate applied mutation for same idempotent intent.

Deterministic error classification:

1. InventoryConcurrencyConflict
2. InventoryExpectedVersionMismatch
3. InventoryDuplicateIdempotencyKey
4. InventoryIdempotencyPayloadMismatch
5. InventoryReservationConflict
6. InventoryAllocationConflict
7. InventorySerialAssignmentConflict
8. InventoryTransferConflict

Prohibited behavior:

1. Silent last-write-wins.
2. Hidden retries that bypass idempotency checks.
3. Mutation on query paths.

Validation readiness:

- Architecture is implementation-ready with explicit conflict paths and deterministic rejection behavior.