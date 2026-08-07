# 01 Slice Scope

Implemented in this slice:

1. InventoryMovementService
2. InventoryAdjustmentService
3. InventoryLedgerService
4. atomic in-memory balance mutation boundary
5. deterministic idempotency records
6. expected-version enforcement for all affected balances
7. read-only movement and ledger query surface
8. audit evidence for movement, adjustment, replay, and integrity scenarios
9. runtime registration for Slice 4 services

Explicitly not implemented:

1. reservation
2. allocation
3. transfer orchestration beyond movement primitives
4. receiving workflow
5. put-away workflow
6. picking
7. packing
8. lot, serial, expiration, reorder policy
9. persistence implementation
10. HTTP APIs
11. external integrations
12. Mission Control routes
13. Slice 5 work