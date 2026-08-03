# 03 Scheduling Domain Model

## Core Contracts

1. ScheduleDefinition
2. ScheduleId
3. ScheduleType
4. OneTimeSchedule
5. IntervalSchedule
6. RecurringSchedule
7. CronSchedule
8. CalendarSchedule
9. ScheduleInstance
10. ScheduleState
11. ScheduleTrigger
12. ScheduleOccurrence
13. NextRun
14. MissedRunPolicy
15. TimeZoneReference
16. ScheduleCommand
17. ScheduleResult
18. ScheduleError
19. ScheduleAuditRecord
20. ScheduleMetrics
21. ScheduleHealth

## Lifecycle States

- DRAFT
- ACTIVE
- PAUSED
- COMPLETED
- CANCELLED
- FAILED

## Determinism Properties

1. Next-run calculation is clock-injected and side-effect free.
2. Schedule evaluation is explicit about UTC timestamps and local-time evaluation context.
3. Occurrence identity is deterministic: instanceId + dueAt timestamp.
4. Missed-run behavior is explicit per schedule policy.
