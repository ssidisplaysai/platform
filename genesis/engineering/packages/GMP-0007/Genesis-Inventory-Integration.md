# Genesis Inventory Integration

## Inventory Boundary
Inventory remains the authority for stock quantities, reservations, adjustments, and receipts.

## Published Requests
- Material Reservation Requested
- Material Consumption Requested
- Finished Goods Receipt Requested

## Consumed From Inventory
- Material Reserved
- Material Shortage
- Inventory Adjustment
- Finished Goods Accepted

## Rules
- Manufacturing does not own inventory quantities.
- Manufacturing does not mutate inventory persistence directly.
- Inventory interactions are contract-first, deterministic, and auditable.
