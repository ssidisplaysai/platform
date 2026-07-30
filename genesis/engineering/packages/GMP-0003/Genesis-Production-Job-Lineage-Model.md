# Genesis Production Job Lineage Model

## Purpose
Lineage preserves immutable source-of-truth ancestry from commercial origin to manufacturing execution authority.

## Required Lineage Chain
- Quote: ID + revision
- Sales Order: ID + revision
- Work Order: ID + revision
- Production Job: derived authoritative execution unit

## Metadata
- `organizationId`
- `correlationId`
- `causationId`
- `manufacturingVersion`
- `createdBy`
- `createdTimestamp`

## Conversion Path
`createProductionJobFromWorkOrder` reads the released Work Order and carries forward sales/quote ancestry into Production Job lineage.

## Integrity Rules
- One Production Job per source Work Order.
- Lineage is captured at creation and remains immutable for ancestry integrity.
