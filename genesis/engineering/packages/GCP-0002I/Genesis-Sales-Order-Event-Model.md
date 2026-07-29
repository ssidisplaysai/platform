# Genesis Sales Order Event Model

## Published Events
- `OrderCreated`
- `OrderApproved`
- `OrderReleased`
- `OrderCancelled`
- `OrderClosed`
- `OrderRevised`

## Event Envelope
Each event includes:
- `eventId`
- `orderId`
- `organizationId`
- `type`
- `actor`
- `createdAt`
- `payload`

## Current Publication Triggers
- Create/order conversion -> `OrderCreated`
- Approve -> `OrderApproved`
- Release -> `OrderReleased`
- Cancel -> `OrderCancelled`
- Close -> `OrderClosed`
- Revision -> `OrderRevised`

## Downstream Consumption Intent
These events are designed for future Manufacturing, Purchasing, Operations, and Executive Intelligence applications. No downstream execution is implemented in this package.
