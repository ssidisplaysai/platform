# 07 State And Lifecycle

InventoryItem lifecycle:

1. Draft
2. Active
3. Restricted
4. Suspended
5. Archived

InventoryBalance lifecycle:

1. Initialized
2. Active
3. Reconciliating
4. Locked
5. Archived

Reservation lifecycle:

1. Pending
2. Active
3. PartiallyConsumed
4. Fulfilled
5. Expired
6. Cancelled

Allocation lifecycle:

1. Proposed
2. Committed
3. PartiallyConsumed
4. Fulfilled
5. Released
6. Cancelled

Movement lifecycle:

1. Registered
2. Validated
3. Applied
4. Rejected
5. Reversed

Lot lifecycle:

1. Created
2. Active
3. Quarantined
4. Expired
5. Disposed

SerialNumber lifecycle:

1. Created
2. Active
3. Reserved
4. Allocated
5. ShippedOrConsumed
6. Retired

Lifecycle rules:

1. Transitions must follow explicit allowed graph.
2. Illegal transition attempts fail closed.
3. Transition facts are logged via ledger/events.
4. Archived state blocks further quantity mutation.