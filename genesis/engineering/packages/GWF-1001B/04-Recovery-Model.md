# 04 Recovery Model

Startup model:
- Engine startup loads a recovery snapshot from persistence before serving commands.
- Snapshot rehydrates definitions, instances, checkpoints, execution history, retries, timeouts, compensations, audits, command records, and metrics.

Runtime continuation:
- Paused and previously active instances are retained as stateful records.
- Recovery bookkeeping is reflected in metrics (recovery count and related gauges).

Safety controls:
- Recovery path treats malformed or missing expected state as a warning/error condition and surfaces it through metrics.
- Invalid resume and missing checkpoint cases fail fast with explicit workflow errors.

Result:
- Restart continuity is deterministic for persisted workflow data.