# 14 Reservation And Allocation Model

Reservation semantics:

1. Reservation represents intent hold against AvailableQuantity.
2. Reservation has scope: item, optional location constraints, optional lot/serial constraints.
3. Reservation may be time-bound with expiration policy.

Allocation semantics:

1. Allocation commits from reserved quantity to execution context.
2. Allocation can be partial and may transition through partial consumption.
3. Allocation release returns quantity to reservable pool by policy.

Lifecycle coupling:

1. Reservation creation reduces AvailableQuantity.
2. Allocation creation does not increase total reserved amount; it partitions commitment.
3. Consumption transitions decrement OnHandQuantity when movement is applied.

Constraint rules:

1. Reservation cannot exceed AvailableQuantity.
2. Allocation cannot exceed remaining reservable quantity.
3. Expired reservation cannot create new allocation.
4. Cancelled reservation cannot be consumed.

Failure handling classes:

1. InsufficientAvailableQuantity
2. ReservationExpired
3. AllocationExceedsReservation
4. ReservationStateInvalid
5. IdempotencyConflict