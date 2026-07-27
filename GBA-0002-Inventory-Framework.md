# GBA-0002 Inventory Framework

## Capability
Inventory coverage includes on-hand, allocated, available, safety stock, reorder point, valuation, and tracking requirements.

## Data Model
- `GbaOperationsInventoryRecord`
- `GbaOperationsInventoryHistory`

## Runtime Notes
- Baseline inventory is seeded if empty.
- Movement history records support replay and audit.
- Low-stock detection (`availableQuantity < reorderPoint`) drives recommendation and health scoring.

## API
- `GET /api/gba/operations/inventory`
