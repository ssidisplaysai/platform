# GBA-0001 KPI Framework

## Scope
Defines KPI contracts, historical measurements, and score/status derivation for executive reporting.

## Contracts
- KPI definition:
  - owner
  - target
  - green/yellow thresholds
  - unit
  - version tag
  - evidence references
- KPI history:
  - measured value
  - trend
  - score
  - status
  - measured timestamp
  - immutable lineage

## Persistence
- `GbaExecutiveKpi`
- `GbaExecutiveKpiHistory`

## Runtime Behavior
- KPI score is computed as bounded percent of measured value vs target.
- KPI status thresholds:
  - `ON_TRACK` when value >= green threshold
  - `AT_RISK` when value >= yellow threshold and < green
  - `BEHIND` otherwise

## Authorization
- View: `gba:executive:view_kpis`
- Manage: `gba:executive:manage_kpis`
