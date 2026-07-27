# GBA-0006 Financial Dashboard

## Purpose
Provide a consistent executive finance snapshot for GLW operators.

## Dashboard Metrics
- Revenue summary
- Gross profit
- Net profit
- Cash position
- AR aging
- AP aging
- Outstanding invoices
- Budget performance
- Cash flow trend
- Operating expenses
- Manufacturing costs
- Executive alerts

## Data Sources
- Finance persisted tables (`GbaFinance*`)
- Seeded cross-agent signals from Sales, Operations, Manufacturing, Marketing, Executive
- Canonical domain runtime health context

## Behavior
- Runtime performs baseline seed on first access per workspace.
- Dashboard is deterministic from persisted and seeded state.
- Immutable lineage/checksum is computed for dashboard snapshots.
