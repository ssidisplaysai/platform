# Event Model

Status: Frozen by GOP-0004A

## 1. Event Identity

Event identity fields:

- eventId: global unique event identifier
- jobId: stream partition key
- moduleId and jobType: domain ownership tags
- occurredAt: event occurrence timestamp
- sequence: per-job monotonic sequence number

## 2. Ordering Model

Ordering is guaranteed per jobId.

Frozen behavior:

- per-job event append acquires transactional lock
- sequence increments by one unless explicitly provided
- event reads order by ascending sequence

No global total ordering across different job streams is guaranteed.

## 3. Replay Model

Replay sources:

- listEventsForJob(jobId)
- listEventsAfterSequence(jobId, sequence)
- replayTimeline(jobId)

Replay rules:

- deterministic by sequence order
- bounded by request parameters in live stream endpoints
- used to reconstruct job timeline and progress summary

## 4. Correlation and Causation

Event links:

- correlationId groups events across systems and callbacks
- causationId links direct predecessor cause when available

Frozen invariant:

- conflicting correlationId in same job stream is rejected when prior correlation exists

## 5. Idempotency Model

Idempotency supports at-least-once delivery safety.

Frozen behavior:

- appendEventIdempotently checks idempotencyKey by job stream
- on duplicate key, returns existing event
- duplicate eventId handling returns existing event when found

## 6. Terminal and Late Events

Terminal job statuses:

- COMPLETE
- FAILED
- TIMED_OUT
- CANCELLED
- ARCHIVED

Frozen rule:

- non-terminal events arriving after terminal status are rejected

This prevents timeline corruption and false reactivation.

## 7. Historical Reconstruction

Reconstruction outputs:

- timeline entries from event stream
- latest status and progress summary
- terminal-state detection

Historical reconstruction is canonical for audit and inspector timeline rendering.

## 8. Trust and Validation Boundaries

Event append validation enforces:

- required fields present
- metadata is object when provided
- sequence consistency via transactional append

Event model trust is conditional on validated append APIs and authorized event producers.
