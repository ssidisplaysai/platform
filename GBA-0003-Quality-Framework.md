# GBA-0003 Quality Framework

## Responsibilities
1. Record quality events with severity and defect taxonomy.
2. Track first-pass yield signals and root-cause references.
3. Expose quality stream to dashboards, health, and recommendations.

## API Contract
1. GET /api/gba/manufacturing/quality.
2. POST /api/gba/manufacturing/quality.
3. POST validates eventType and severity enumerations.

## Authorization
1. Read action: gba:manufacturing:view_quality.
2. Mutation action: gba:manufacturing:manage_quality.

## Persistence
1. Prisma model: GbaManufacturingQualityEvent.
2. Indexed by workspace, organization, severity, and recordedAt.
