# 09 Domain Events

Event design principles:

1. Events are immutable historical facts.
2. Event payload contains canonical IDs, tenant scope, version, timestamp.
3. Events include causation and correlation identifiers.
4. Event publication is at-least-once compatible; consumers must be idempotent.

Core event catalog:

1. InventoryItemCreated
2. InventoryItemActivated
3. InventoryItemRestricted
4. InventoryItemArchived
5. InventoryBalanceInitialized
6. InventoryBalanceAdjusted
7. InventoryBalanceReconciled
8. InventoryMovementRegistered
9. InventoryMovementApplied
10. InventoryMovementRejected
11. InventoryMovementReversed
12. ReservationCreated
13. ReservationPartiallyConsumed
14. ReservationFulfilled
15. ReservationExpired
16. ReservationCancelled
17. AllocationCommitted
18. AllocationPartiallyConsumed
19. AllocationFulfilled
20. AllocationReleased
21. TransferInitiated
22. TransferCompleted
23. TransferCancelled
24. LotCreated
25. LotQuarantined
26. LotExpired
27. SerialNumberRegistered
28. SerialNumberReserved
29. SerialNumberAllocated
30. SerialNumberRetired
31. ReorderPolicyDefined
32. SafetyStockPolicyUpdated

Event schema minimum fields:

1. EventId
2. EventType
3. TenantId
4. AggregateId
5. AggregateType
6. AggregateVersion
7. OccurredAt
8. CorrelationId
9. CausationId
10. IdempotencyKey (when command-originated)