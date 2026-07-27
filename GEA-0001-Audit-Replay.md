# GEA-0001 Audit and Replay

## Audit Coverage
Runtime emits audit records for:
1. execution.queued
2. execution.completed
3. execution.paused
4. execution.resumed
5. execution.cancelled
6. execution.replayed
7. approval.pending
8. approval.approved
9. approval.rejected
10. permission.denied
11. tool.denied
12. task.completed

Stored via GeaAgentAuditRecord in Prisma and repository listAuditRecords.

## Replay Model
Replay records include:
1. replayId
2. executionId
3. replayOfExecutionId
4. deterministicMatch
5. replayChecksum
6. createdAt

## Deterministic Replay Check
Replay checksum is generated from execution context plus action output material, then persisted as GeaAgentReplay.

## Operator Access
1. /api/gea/audit exposes audit + replay records.
2. /api/gea/replay creates replay evidence for an execution.
3. /glw/agents/replay and /glw/agents/audit provide protected workspace visibility.
