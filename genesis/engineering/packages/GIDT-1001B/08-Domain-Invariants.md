# 08 Domain Invariants

Global invariants:

1. Tenant isolation is absolute across all Inventory entities.
2. Every InventoryBalance must reference a valid InventoryItem.
3. AvailableQuantity <= OnHandQuantity.
4. ReservedQuantity <= OnHandQuantity.
5. AllocatedQuantity <= ReservedQuantity when allocation depends on reservation.
6. OnHandQuantity cannot be negative.
7. AvailableQuantity cannot be negative.
8. ReservedQuantity cannot be negative.
9. AllocatedQuantity cannot be negative.
10. LotCode uniqueness is tenant+product scoped.
11. SerialCode uniqueness is tenant+product scoped.
12. SerialNumber active location assignment is unique at any time.
13. Ledger entries are append-only immutable facts.
14. Snapshot timestamps are monotonic per scope.
15. Movement application requires idempotency evaluation.
16. Reservation expiration cannot increase committed quantity.
17. Allocation cannot exceed remaining reservable quantity.
18. Cross-warehouse transfers preserve quantity conservation.
19. Expired stock cannot become allocatable without explicit requalification policy.
20. Foreign references cannot be mutated by Inventory domain logic.

Invariant ownership posture:

- Invariants are enforced by Inventory aggregate boundaries and not delegated to shared infrastructure semantics.