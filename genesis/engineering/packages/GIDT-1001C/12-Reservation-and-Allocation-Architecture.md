# 12 Reservation And Allocation Architecture

Separation contract:

1. Reservation expresses intent hold against available stock.
2. Allocation commits specific stock scope for execution.
3. Reservation and allocation remain separate aggregates with explicit conversion pathways.

Reservation lifecycle architecture:

1. Create reservation after availability and expected-version checks.
2. Reduce reservable availability according to rule set.
3. Support partial fulfillment, partial release, full release, expiry, and cancellation.
4. Expiry transitions triggered by time policy and validation at command boundaries.

Allocation lifecycle architecture:

1. Create allocation from active reservation or approved direct allocation authority.
2. Bind scope to warehouse/location/lot/serial as command requires.
3. Support partial fulfillment and partial release.
4. Prevent over-allocation via reservation remaining-quantity invariant.

Reservation to allocation conversion:

1. Validate reservation active state.
2. Validate remaining quantity.
3. Validate scope compatibility.
4. Allocate quantity and update reservation remaining quantity in coordinated write.
5. Append ledger and audit facts.

Race and conflict handling:

1. Reservation race resolved with expected-version and compare-on-write.
2. Allocation race resolved with reservation version and quantity invariant checks.
3. Duplicate commands resolved through idempotency records.

Rejection classes:

1. OverReservationRejected
2. OverAllocationRejected
3. ReservationExpiredRejected
4. ReservationStateConflict
5. AllocationStateConflict

Atomicity rules:

1. Reservation and derived balance effect updates commit atomically.
2. Allocation and reservation remaining quantity updates commit atomically.
3. Failure in any participant prevents partial state mutation.

Audit evidence:

1. Record intent, actor, reservation/allocation state before and after, and reason codes.
2. Record expiration and cancellation reasons.
3. Record conversion links between reservation and allocation.

Idempotency:

1. ReserveInventory, ReleaseReservation, AllocateInventory, and ReleaseAllocation all require keys.
2. Duplicate-with-different-payload is deterministic reject.