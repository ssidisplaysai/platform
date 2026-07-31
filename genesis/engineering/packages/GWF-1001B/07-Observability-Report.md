# 07 Observability Report

Metrics model expansion:
- Active workflow instance gauge
- Paused/completed/failed/timed-out gauges
- Retry and compensation counters
- Checkpoint and recovery counters
- Concurrency conflict counter
- Duplicate command counter
- Lifecycle publish-failure counter
- Context and audit persistence failure counters
- Average execution and step duration
- Oldest active workflow age
- Oldest pending retry age

Health synthesis behavior:
- Health degrades on failed/timed-out runtime conditions.
- Health also degrades on publish/persistence warning channels for operational visibility.

Audit visibility:
- Lifecycle publish failures are captured in audit records.

Operational effect:
- Readiness telemetry is sufficient to identify platform reliability regressions before user-visible failure escalation.