# Genesis Commerce Correlation Model

## Correlation Requirements
Every cross-application workflow shall preserve:
1. correlationId
2. causationId
3. originatingAggregate
4. originatingApplication
5. workflowId

## Correlation Envelope Extension
```yaml
WorkflowCorrelation:
  correlationId: string
  causationId: string | null
  workflowId: string
  originatingApplication: string
  originatingAggregate:
    aggregateType: string
    aggregateId: string
    aggregateVersion: integer
```

## Model Behavior
1. correlationId remains constant across workflow chain.
2. causationId references immediate preceding event or command.
3. workflowId groups all participating operations.
4. origin metadata enables cross-application trace reconstruction.

## Traceability Outcomes
1. Deterministic replay with preserved chain order.
2. Audit reconstruction across producer and consumer systems.
3. Causality debugging for transient and dependency failures.

## Governance Rules
1. Missing correlation metadata is contract-invalid.
2. Consumers must reject malformed or missing correlation fields.
3. Producer must publish complete correlation fields for every emitted event.
