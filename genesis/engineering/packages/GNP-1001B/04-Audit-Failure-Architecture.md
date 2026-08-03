# 04 Audit Failure Architecture

Strategy:
1. `NotificationAuditWriter` classifies write failures and records in-memory failure events.
2. `NotificationEngine` retries audit writes once for retryable failures.
3. Audit failures are counted in metrics and reflected in health reporting.
4. Audit processing remains non-blocking for notification completion unless the delivery path itself fails.
5. Recovery and backlog are visible through metrics and health snapshots.

Operational signals:
1. auditFailures
2. auditRetries
3. auditRecoveries
4. auditBacklog
5. auditLatencyMs

Boundary note:
- The audit path is still notification-internal observability; it does not transfer ownership of transport or workflow execution.
