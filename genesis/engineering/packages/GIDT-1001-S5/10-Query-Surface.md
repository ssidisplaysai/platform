# 10 Query Surface

Added read-only deterministic query services:
- InventoryReservationQueryService
- InventoryAllocationQueryService

Reservation queries:
- GetReservation
- ListReservations
- ListReservationsByInventoryItem
- ListReservationsByBalance
- ListActiveReservations
- ListExpiredReservations

Allocation queries:
- GetAllocation
- ListAllocations
- ListAllocationsByInventoryItem
- ListAllocationsByBalance
- ListAllocationsByReservation
- ListActiveAllocations

No mutation behavior exists in query services.
