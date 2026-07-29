# Genesis Sales Order Domain Model

## Aggregate Root
- Entity: SalesOrder
- Key: immutable `documentId`
- Number: immutable `orderNumber`

## Core Fields
- `organizationId`
- `customerReference`
- `ownerReference`
- `salesRepresentativeReference`
- `status`
- `approvalStatus`
- `lines`
- `totals`
- `revisionHistory`
- `approvalHistory`

## Quote Lineage Contract
Every Sales Order records:
- Originating Quote ID
- Quote Revision ID
- Acceptance timestamp
- Accepted by
- Pricing snapshot reference
- Conversion event ID

## Revision Contract
Each revision preserves:
- Previous state and next state
- Reason
- Author
- Timestamp
- Changed fields

## Audit Contract
Every mutation writes an audit event with:
- Event id
- Order id
- Actor
- Timestamp
- Summary
- Correlation id (optional)

## Search Contract
Indexed dimensions:
- Order Number
- Customer
- Quote
- Status
- Date
- Salesperson
- Reference Number

## Ownership and Boundaries
- Commerce owns all Sales Order aggregate records.
- Business Genome, Manufacturing, Finance, Shipping remain external authorities.
