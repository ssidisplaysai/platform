# Message Model

## Canonical Envelope Fields

Every GMP-1001 envelope includes:

- messageId
- correlationId
- causationId
- tenant
- workspace
- sourceApplication
- sourceCapability
- timestamp
- version
- priority
- headers
- payload
- metadata

## Delivery Metadata Support

Envelope metadata supports:

- idempotencyKey
- orderingKey
- traceId
- contentType
- schema
- retryCount

## Delivery Modes Supported

- FIRE_AND_FORGET
- REQUEST_REPLY
- PUBLISH_SUBSCRIBE
- BROADCAST
- POINT_TO_POINT
