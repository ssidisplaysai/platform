# Genesis Execution Events

## Versioned Events
- ExecutionCreated
- ExecutionStarted
- ExecutionPaused
- ExecutionResumed
- ExecutionBlocked
- ExecutionCompleted
- ExecutionCancelled
- ExecutionFailed
- ExecutionRecovered
- ExecutionArchived

## Event Fields
Each event includes:
- Event ID
- Contract Version
- Aggregate ID
- Aggregate Version
- Timestamp
- Actor
- Correlation ID
- Causation ID
- Payload
- Metadata

## Rules
- Events are versioned and immutable in payload form.
- Event publication does not perform downstream execution.
