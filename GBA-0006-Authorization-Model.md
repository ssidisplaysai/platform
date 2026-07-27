# GBA-0006 Authorization Model

## Action Set
- `gba:finance:view_dashboard`
- `gba:finance:view_general_ledger`
- `gba:finance:view_accounts_receivable`
- `gba:finance:view_accounts_payable`
- `gba:finance:view_budgets`
- `gba:finance:manage_budgets`
- `gba:finance:view_profitability`
- `gba:finance:view_forecasts`
- `gba:finance:view_kpis`
- `gba:finance:view_recommendations`
- `gba:finance:review_recommendations`
- `gba:finance:view_executive_reports`
- `gba:finance:view_health`

## Policy Expectations
- Viewer role is read-only.
- Budget management and recommendation review are non-viewer privileges.
- Route and API checks resolve through GOP runtime with workspace membership enforcement.
