# GBA-0005 Authorization Model

## Route Actions
- gba:sales:view_dashboard
- gba:sales:view_pipeline
- gba:sales:manage_pipeline
- gba:sales:view_forecasting
- gba:sales:view_accounts
- gba:sales:view_recommendations
- gba:sales:review_recommendations
- gba:sales:view_health

## Policy Expectations
- Viewer role is read-only for Sales routes.
- Mutation paths require administrator/operator-level grants through GOP policy resolution.
- Default deny remains enforced.
