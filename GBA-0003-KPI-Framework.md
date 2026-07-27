# GBA-0003 KPI Framework

## Responsibilities
1. Maintain KPI definitions for manufacturing performance.
2. Capture KPI history snapshots with measured values and trend.
3. Compute display score relative to configured targets.

## Data Contract
1. Definition model: ManufacturingKpiDefinition.
2. History model: ManufacturingKpiHistory.
3. Scoring function clamps performance score to 0-100.

## Persistence
1. Prisma model: GbaManufacturingKpi.
2. Prisma model: GbaManufacturingKpiHistory.
3. Indexed by workspace and measurement recency.

## Runtime Behavior
1. Seeds baseline KPI set for empty state.
2. Returns latest measurement per KPI for dashboard/summary use.
