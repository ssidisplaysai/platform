# GBA-0003 Production Orders

## Responsibilities
1. Create and list manufacturing production orders.
2. Track production status transitions and history.
3. Publish operations-aligned manufacturing signals from current state.

## API Contract
1. GET /api/gba/manufacturing/production-orders.
2. POST /api/gba/manufacturing/production-orders.
3. POST requires title, sku, priority, quantityPlanned, scheduledStartAt, scheduledEndAt.

## Authorization
1. View action: gba:manufacturing:view_production_orders.
2. Mutation action: gba:manufacturing:manage_production_orders.
3. Viewers are denied mutation by policy.

## Persistence
1. Prisma model: GbaManufacturingProductionOrder.
2. Prisma model: GbaManufacturingProductionOrderHistory.
3. Indexed by workspace/organization/status recency.
