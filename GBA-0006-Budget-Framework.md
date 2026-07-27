# GBA-0006 Budget Framework

## Coverage
Budget monitoring includes department/business-unit/project scopes with capex, opex, spend, and variance.

## Controls
- Read action: `gba:finance:view_budgets`
- Manage action (reserved for future mutation paths): `gba:finance:manage_budgets`

## v1.0 Behavior
- API is read-only for budgets.
- Workspace displays variance and scope health.
- Budget signals contribute to recommendation and health calculations.
