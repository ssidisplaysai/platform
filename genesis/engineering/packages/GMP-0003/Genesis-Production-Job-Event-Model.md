# Genesis Production Job Event Model

## Event Types
Representative published event types include:
- `ProductionJobCreated`
- `ProductionJobQueued`
- `ProductionJobReady`
- `ProductionJobReleased`
- `ProductionJobStarted`
- `ProductionJobPaused`
- `ProductionJobResumed`
- `ProductionJobCompleted`
- `ProductionJobCancelled`
- `ProductionJobClosed`
- `ProductionJobRevisionCreated`

## Envelope Fields
- Event ID
- Aggregate ID
- Event type
- Actor
- Timestamp
- Organization/site scope
- Correlation and causation metadata

## Consumers
Events are intended for enterprise observability and orchestration consumers, not direct machine control.

## Guarantee
Every valid lifecycle/revision mutation emits a deterministic, auditable publication record.
