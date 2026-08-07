# GIDT-1001-S5

Inventory Platform Slice 5 implementation package for Reservation and Allocation.

## Scope
- Reservation create, release, expiry.
- Allocation create, release.
- Reservation-to-allocation conversion.
- Balance commitment mutation extensions.
- Optimistic concurrency and idempotency.
- Read-only reservation/allocation queries.
- Runtime registration for Slice 5 services.

## Out of Scope
- Persistence.
- Receiving, put-away, picking, packing, shipment orchestration.
- Lot, serial, expiration tracking implementation.
- APIs, integrations, Mission Control routes.
