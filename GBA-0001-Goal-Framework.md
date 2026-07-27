# GBA-0001 Goal Framework

## Scope
Defines executive goals with hierarchy, progress tracking, and append-only history records.

## Contracts
- Goal definition:
  - level (`ENTERPRISE`, `BUSINESS_UNIT`, `DEPARTMENT`, `PROJECT`, `INDIVIDUAL`)
  - owner
  - objective
  - key results
  - milestones
  - dependencies
  - deadline
  - progress percent
  - status
- Goal history record:
  - progress percent
  - status
  - changed by
  - changed at
  - immutable lineage

## Runtime Behavior
- Status is deterministically derived from progress percent:
  - `COMPLETE` >= 100
  - `ON_TRACK` >= 75
  - `AT_RISK` >= 50
  - `BEHIND` >= 25
  - `BLOCKED` < 25

## Persistence
- `GbaExecutiveGoal`
- `GbaExecutiveGoalHistory`

## Authorization
- View: `gba:executive:view_goals`
- Manage: `gba:executive:manage_goals`
