# 07 Persistence and Recovery

## Persistence Abstractions

1. ScheduleDefinitionStore
2. ScheduleInstanceStore
3. ScheduleOccurrenceStore
4. ScheduleClaimStore
5. ScheduleAuditStore
6. ScheduleMetricsStore
7. SchedulingPersistenceCoordinator

## Durable Adapter

File-backed adapter implemented via:
- src/platform/scheduling/persistence/FileStores.ts
- src/platform/scheduling/persistence/PersistenceCoordinator.ts

## Recovery Model

1. Rehydrate schedule definitions and instances.
2. Rehydrate occurrences, claims, audit, and metrics.
3. Recover expired claims to EXPIRED state.
4. Preserve audit continuity and metrics continuity.
5. Track recovery count in metrics.

## Corrupt State Visibility

Corrupt or invalid transitions are surfaced through explicit errors and schedule-failed audit events.
