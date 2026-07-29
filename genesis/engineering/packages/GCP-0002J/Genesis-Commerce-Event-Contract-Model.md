# Genesis Commerce Event Contract Model

## Mandatory Event Envelope
Every published event shall include:
1. eventId
2. contractVersion
3. aggregateType
4. aggregateId
5. aggregateVersion
6. correlationId
7. causationId
8. timestamp
9. actor
10. organization
11. payload
12. metadata
13. idempotencyKey

## Canonical Event Envelope Schema
```yaml
EventEnvelope:
  eventId: string
  contractVersion:
    major: integer
    minor: integer
    patch: integer
  aggregateType: string
  aggregateId: string
  aggregateVersion: integer
  correlationId: string
  causationId: string | null
  workflow:
    workflowId: string
    originatingApplication: string
    originatingAggregateType: string
    originatingAggregateId: string
  timestamp: string # ISO-8601 UTC
  actor:
    actorId: string
    actorType: string
    roles: [string]
  organization:
    organizationId: string
    siteId: string | null
  payload: object
  metadata:
    schemaRef: string
    publishedBy: string
    publishedAt: string
    securityContext: object
  idempotencyKey: string
```

## Contract Properties
1. Immutability: payload and metadata are never mutated after publication.
2. Determinism: key identity fields are deterministic for replay and audit.
3. Traceability: correlation and causation support cross-application workflow tracing.
4. Security Context: actor and organization context are explicit and auditable.

## Compatibility Rules
1. Additive payload fields are non-breaking.
2. Field removal, rename, or semantic meaning changes are breaking.
3. Breaking changes require major version increment.
