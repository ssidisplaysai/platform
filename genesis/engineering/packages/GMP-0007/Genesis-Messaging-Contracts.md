# Genesis Messaging Contracts

## Messaging Model
Messaging defines the transport-agnostic contract shape for commands, events, replies, retries, correlation, causation, and dead-letter handling.

## Required Elements
- Contract version
- Producer
- Consumer
- Payload
- Schema
- Compatibility rules
- Deprecation rules
- Correlation ID
- Causation ID
- Timestamp
- Trace ID
- Organization
- Metadata

## Rules
- Messages must be deterministic and idempotent where applicable.
- Retry semantics must be explicitly defined.
- Dead-letter handling must be observable and auditable.
