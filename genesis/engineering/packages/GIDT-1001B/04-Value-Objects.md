# 04 Value Objects

Core value objects:

1. Quantity
- Decimal-capable numeric value with explicit unit.

2. UnitOfMeasure
- Canonical UoM code and compatibility family.

3. AvailableQuantity
4. ReservedQuantity
5. AllocatedQuantity
6. OnHandQuantity
7. IncomingQuantity
8. OutgoingQuantity
- Quantity specializations with invariant constraints.

9. ReorderPoint
10. SafetyStockQuantity
- Policy threshold quantities.

11. WarehouseCode
12. LocationCode
13. BinCode
14. LotCode
15. SerialCode
- Stable business identifiers.

16. MovementType
17. AdjustmentReason
18. ReservationReason
19. AllocationReason
- Enumerated categorical reasons/types.

20. ExpirationDate
21. EffectiveDateRange
- Time boundary values with ordering rules.

22. InventoryStatusCode
- Normalized status code.

23. InventoryVersion
24. ConcurrencyToken
- Optimistic concurrency values.

25. ProductIdentifier
26. VariantIdentifier
27. OrganizationIdentifier
28. DocumentIdentifier
29. KnowledgeIdentifier
30. AssetIdentifier
- Foreign reference identifier values.

31. MetadataCollection
- Bounded key-value metadata object with allowed-key policy.

Value-object rules:

1. Immutable after creation.
2. Equality by value, not identity.
3. Validation occurs at construction boundaries.
4. No embedded ownership transfer semantics.
5. No runtime side effects.