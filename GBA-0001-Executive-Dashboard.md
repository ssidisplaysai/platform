# GBA-0001 Executive Dashboard

## Purpose
Provide executive-level cross-functional visibility in a deterministic, governed view.

## Dashboard Metrics
- Revenue
- Profit
- Cash flow
- Sales pipeline
- Marketing performance
- Manufacturing throughput
- Inventory health
- Purchasing status
- Customer health
- Project health
- System health

## Data Strategy
- KPI definitions and KPI history are loaded from repository contracts.
- If no KPI history exists for a metric, deterministic fallback values are used.
- Metric lineage is retained through evidence references and immutable lineage checksum.

## Dashboard API
- `GET /api/gba/executive/dashboard`
- Scope filters supported through query params:
  - `company`
  - `division`
  - `department`
  - `projectId`
  - `period`
  - `geography`

## Governance
- Access controlled by `gba:executive:view_dashboard`.
- Route-level policy resolution runs through GOP authorization runtime.
