# Genesis Purchasing Integration

## Purchasing Boundary
Purchasing remains the authority for purchase order creation and supplier commitment management.

## Published From Manufacturing
- Material Demand
- Supplier Demand
- Expedite Request

## Consumed By Manufacturing
- Purchase Order Status
- Material ETA
- Supplier Delay

## Rules
- Manufacturing shall not create purchase orders.
- Manufacturing may publish demand signals only.
- Purchasing responses remain authoritative and versioned.
