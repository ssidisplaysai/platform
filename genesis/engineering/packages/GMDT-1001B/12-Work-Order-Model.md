# 12 Work Order Model

ManufacturingWorkOrder is the primary execution aggregate.

## Required Model Fields

- workOrderId
- workOrderNumber
- tenant
- productReference
- productVersionReference
- productBomReference
- requestedQuantity
- plannedQuantity
- completedQuantity
- rejectedQuantity
- scrapQuantity
- reworkQuantity
- executionRoutingReference or owned executionRouting
- workCenter or productionCell assignment reference
- schedule requirement metadata
- priority
- currentStatus
- workInProgressState
- plannedStart
- plannedEnd
- actualStart
- actualEnd
- correlationId
- idempotencyKey
- audit metadata
- version

Optional fields:
- productVariantReference
- externalDemandReference or commerceOrderReference
- notes

## Work Order Ownership Rule

ManufacturingWorkOrder is Manufacturing authority and must never become Commerce order authority.

## Quantity Coherence Rule

At all times, quantity relations must satisfy approved coherence policies for requested, planned, completed, rejected, scrap, and rework values with non-negative constraints.
