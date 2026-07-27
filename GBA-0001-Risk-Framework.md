# GBA-0001 Risk Framework

## Scope
Risk capture and review trail for executive oversight and enterprise health scoring.

## Risk Contracts
- risk category
- title
- probability
- impact
- owner
- mitigation
- status
- evidence references
- created/updated timestamps

## Risk History
- status
- review note
- reviewed by
- reviewed at
- immutable lineage

## Health Contribution
- `criticalRiskCount` increments when:
  - impact >= 70
  - probability >= 50
- Health status summary uses critical risk counts plus goal backlog and pending approvals.

## Persistence
- `GbaExecutiveRisk`
- `GbaExecutiveRiskHistory`

## Authorization
- View: `gba:executive:view_risks`
- Manage: `gba:executive:manage_risks`
