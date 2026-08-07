# 03 Movement Service

Implemented behavior:

1. validate movement command structure and movement type
2. validate tenant scope
3. validate Inventory Item and source or destination balance references
4. validate quantity and reason
5. enforce expected versions for every affected balance
6. enforce deterministic tenant-scoped idempotency
7. evaluate quantity invariants before mutation
8. reject insufficient stock
9. reject prohibited self-movement
10. update affected balances atomically in memory
11. create immutable movement record
12. append immutable ledger entries
13. emit accepted, rejected, and replay audit evidence
14. expose deterministic retrieval and listing

No-partial-mutation posture:

1. all validation occurs before mutation
2. proposed source and destination balances are computed first
3. ledger appendability is verified before commit
4. committed mutation occurs only after the full proposal is valid