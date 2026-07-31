# Mission Control Integration

## Endpoints Added

1. /api/gop/messaging/health
2. /api/gop/messaging/metrics

## GOP Metrics Integration

src/lib/gop/events-api.ts now includes messaging:

- messagingMetadata
- messagingMetrics
- messagingHealth
- messagingQueue
- messagingSubscribers

## Exposed Messaging Operational Data

- Capability metadata.
- Delivery and failure counters.
- Queue statistics.
- Subscriber statistics.
- Health checks and status.
