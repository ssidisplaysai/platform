# GBA-0002 Warehouse Framework

## Capability
Warehouse operations include receiving, put-away, picking, packing, shipping, transfer, and cycle-count tracking with utilization visibility.

## Data Model
- `GbaOperationsWarehouseOperation`
- `GbaOperationsWarehouseHistory`

## Runtime Notes
- Baseline operation is seeded if empty.
- Status transitions and notes are auditable through history records.
- Utilization is surfaced in dashboard metrics.

## API
- `GET /api/gba/operations/warehouse`
