# Genesis Quote Audit Model

## Event Types
- quote_created
- line_added
- line_removed
- quantity_changed
- price_changed
- discount_changed
- submitted
- approved
- rejected
- withdrawn
- presented
- viewed
- accepted
- cancelled
- expired
- revision_created
- conversion_requested

## Event Contract
- eventId
- quoteId
- organizationId
- actor
- createdAt
- summary
- correlationId

## Usage
Audit stream is queryable through quote repository and API audit route.
