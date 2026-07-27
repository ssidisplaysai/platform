# GBA-0003 Machine Framework

## Responsibilities
1. Track machine status and utilization metrics.
2. Record machine status history and change notes.
3. Surface machine state to dashboard, health, and operations signals.

## API Contract
1. GET /api/gba/manufacturing/machines.
2. POST /api/gba/manufacturing/machines (status update).

## Authorization
1. View action: gba:manufacturing:view_machines.
2. Mutation action: gba:manufacturing:manage_machines.

## Persistence
1. Prisma model: GbaManufacturingMachine.
2. Prisma model: GbaManufacturingMachineHistory.
3. Indexed by status and updatedAt/changedAt.
