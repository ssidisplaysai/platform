# GBA-0002 KPI Framework

## Capability
Operations KPI definitions and history provide trendable scorecards for executive and operational visibility.

## Data Model
- `GbaOperationsKpi`
- `GbaOperationsKpiHistory`
- `GbaOperationsExecutiveSummary`

## Runtime Notes
- KPI score is derived as bounded ratio-to-target.
- Daily and weekly executive summaries are generated from dashboard and recommendation state.

## APIs
- `GET /api/gba/operations/kpis`
- `GET /api/gba/operations/dashboard`
- `GET /api/gba/operations/health`
