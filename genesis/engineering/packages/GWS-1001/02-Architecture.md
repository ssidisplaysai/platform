# 02 Architecture

## Scheduling Platform Boundaries

Scheduling owns:
- Schedule definitions and versioning
- Schedule lifecycle state
- Next-run calculation and recurrence evaluation
- Missed-run policy application
- Occurrence claiming and dispatch eligibility
- Scheduling audit, metrics, and health
- Recovery-safe persisted state rehydration

Scheduling does not own:
- Workflow execution logic
- Messaging transport internals
- Notification delivery
- Application business logic
- Identity credential/session handling

## High-Level Design

1. Contracts define deterministic, serializable scheduling domain model.
2. ScheduleRegistry validates and versions schedule definitions.
3. ScheduleCalculator computes due and next runs using injected Clock and timezone-aware local matching.
4. SchedulingEngine evaluates due schedules, claims occurrences, and dispatches commands through Messaging.
5. PersistenceCoordinator provides restart-safe, file-backed state stores.
6. Mission Control endpoints expose scheduling health and metrics read-only surfaces.
