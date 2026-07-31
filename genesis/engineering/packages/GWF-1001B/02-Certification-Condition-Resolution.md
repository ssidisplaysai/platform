# 02 Certification Condition Resolution

Source conditions: GWF-1001A certification conditions C1-C4.

C1 Durability and Recovery:
- Implemented file-backed persistence stores for workflow state domains.
- Implemented coordinated recovery snapshot loading during engine startup.
- Added recovery bookkeeping metrics and restart hydration logic.
- Evidence: 03-Persistence-Architecture.md, 04-Recovery-Model.md, 06-Negative-Path-Test-Report.md.

C2 Concurrency and Idempotency:
- Added same-instance command lock to prevent concurrent mutation races.
- Added idempotent command detection via command key persistence.
- Added optimistic stale-version write detection and explicit stale rejection.
- Evidence: 05-Concurrency-and-Idempotency.md, 06-Negative-Path-Test-Report.md.

C3 Negative-Path Reliability Testing:
- Replaced workflow suite with explicit hardening matrix covering timeout, retries, compensation success/failure, invalid transition, duplicate command, stale write, lifecycle publish failure, persistence failures, checkpoint anomalies, invalid resume, non-Error step failure, and restart continuity.
- Evidence: 06-Negative-Path-Test-Report.md, GWF-1001B-Validation-Report.md.

C4 Observability and Readiness:
- Expanded readiness/metrics model with active gauges, oldest-age gauges, recovery and persistence counters, duplicate/conflict counters, and lifecycle publish-failure counters.
- Updated health degradation to include persistence and publish warning channels.
- Verified mission control readiness payload compatibility in tests.
- Evidence: 07-Observability-Report.md, 08-Compatibility-Report.md, 09-Operational-Readiness.md.

Resolution status:
- Engineering resolution complete for C1-C4.
- Independent certification decision pending separate certification package.