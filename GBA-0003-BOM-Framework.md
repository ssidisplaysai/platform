# GBA-0003 BOM Framework

## Responsibilities
1. Maintain deterministic, revisioned BOM records.
2. Preserve additive BOM history events with immutable lineage.
3. Provide API read surface for authorized users.

## Data Contract Highlights
1. Primary model: ManufacturingBom.
2. History model: ManufacturingBomHistory.
3. Key fields: sku, revision, effective window, components, substitutions, costRollup.

## Persistence
1. Prisma model: GbaManufacturingBom.
2. Prisma model: GbaManufacturingBomHistory.
3. Migration: prisma/migrations/20260728003000_gba_manufacturing_agent_v1/migration.sql.

## Runtime Behavior
1. Seeds baseline BOM when workspace is empty.
2. Writes immutable lineage for current state and history.
3. Sort order by updatedAt DESC (records) and changedAt DESC (history).
