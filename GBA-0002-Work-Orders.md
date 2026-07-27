# GBA-0002 Work Orders

## Capability
The Operations Agent supports work-order listing and creation with deterministic lineage and timeline capture.

## Contract
Creation payload:
- `title: string`
- `priority: P1|P2|P3|P4`
- `dueDate: ISO-8601`
- optional `dependencies: string[]`
- optional `assignedResources: string[]`
- optional `estimatedLaborHours: number`

## Behaviors
- New work orders initialize at `PLANNED` with `completionPercent=0`.
- History records are written at creation.
- Timeline events are emitted for auditability.
- Orchestration workflow startup is triggered to coordinate execution.

## Authorization
- Read: `gba:operations:view_work_orders`
- Write: `gba:operations:manage_work_orders`
