# GBA-0006 - Genesis Finance Agent v1.0

## Scope
GBA-0006 delivers the Finance Agent v1.0 as an additive slice with no redesign of frozen modules.

## Delivered Components
- Runtime: finance dashboard synthesis, seeded baseline, recommendations, health snapshots, review lineage.
- API: authenticated/authorized handlers for dashboard, ledger, AR, AP, budgets, profitability, forecasts, KPIs, recommendations, executive reports, health.
- Workspace: protected Finance Agent views under GLW.
- Authorization: new `gba:finance:*` action family with default-deny preserved.
- Persistence: additive Prisma models and migration `20260728040000_gba_finance_agent_v1`.
- Tests: runtime, API, route forwarding, authorization, workspace rendering.

## Boundaries
- No mutation paths beyond recommendation review in v1.0 API.
- No changes to frozen GBA-0005 artifacts.
- Additive-only schema changes.
