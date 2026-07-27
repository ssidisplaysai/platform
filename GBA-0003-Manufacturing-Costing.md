# GBA-0003 Manufacturing Costing

## Responsibilities
1. Store manufacturing cost records by production order and costing version.
2. Compute and expose total manufacturing cost and variance.
3. Feed costing summary into executive report generation.

## Data Contract
1. Model: ManufacturingCostRecord.
2. Components: materialCost, laborCost, machineCost, overheadCost, burdenCost.
3. Output: totalManufacturingCost, costVariance, measuredAt.

## Persistence
1. Prisma model: GbaManufacturingCostRecord.
2. Indexed by workspace/organization/productionOrder and recency.

## Runtime Behavior
1. Seeds baseline costing sample for empty workspace state.
2. Provides deterministic list ordering for reporting workflows.
