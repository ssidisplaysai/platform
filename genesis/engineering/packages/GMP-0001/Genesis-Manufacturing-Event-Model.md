# Genesis Manufacturing Event Model

## Manufacturing Published Event Set
Manufacturing publishes:
1. WorkOrderCreated
2. ProductionStarted
3. OperationCompleted
4. ProductionPaused
5. ProductionResumed
6. ProductionCompleted
7. QualityPassed
8. QualityFailed
9. WorkOrderClosed
10. MachineOffline
11. MachineOnline
12. MaterialConsumed

## Event Model Principles
1. Events represent immutable operational facts.
2. Event names are aggregate and lifecycle semantic.
3. Events include identity, organization, actor, and timestamp metadata.
4. Events preserve correlation and causation context.

## Event Governance
1. Event payloads are versioned.
2. Breaking payload changes require major contract version increments.
3. Event publication does not imply ownership of external domain authority.

## Consumption Intent
Manufacturing events support:
1. Executive Intelligence
2. Business Genome evidence compilation
3. Operational observability and analytics
4. Inter-domain workflow triggers through approved contracts
