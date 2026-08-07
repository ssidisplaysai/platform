# 06 Atomicity Model

Implemented in-memory atomicity boundary:

1. validate all affected state before mutation
2. compute proposed source and destination states immutably
3. validate proposed balances against invariants
4. create movement and ledger records before commit
5. verify ledger appendability before commit
6. commit balance, movement, ledger, and idempotency updates together in one bounded in-memory step
7. rollback by discarding proposed state before commit on any validation failure
8. avoid hidden side effects during validation

Durability limitation:

1. durable transactional persistence atomicity is not claimed here
2. durable atomicity remains explicitly deferred to Slice 9