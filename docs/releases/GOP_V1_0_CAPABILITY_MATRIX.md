# GOP v1.0 Capability Matrix

| Capability | Status | Evidence |
|---|---|---|
| Durable Jobs | Certified | GLW repository + GOP event integration |
| Durable Executions | Certified | GopExecution model + execution repository |
| Durable Events | Certified | GopJobEvent + event-store |
| Replay | Certified | replay-engine + repository replay |
| Recovery | Certified | ensureRecovered + failure tests |
| Authorization | Certified | policy resolver + guarded APIs |
| Operations Center | Certified | /api/gop/operations + SSE + dashboard |
| Queue Management | Certified | queue-manager state and metrics |
| Lease Management | Certified | acquire/renew/release/expire/steal |
| Worker Registry | Certified | registration/heartbeat/health/capacity |
| Worker Protocol | Certified | signed token protocol endpoints |
| Dead-letter Control | Certified | list/retry/archive API and queue paths |
| Snapshotting | Certified | snapshot-engine + persisted snapshots |
| Runtime Fabric Metrics | Certified | queue/fabric metrics in operations snapshot |
| Workspace Isolation | Certified | workspace/module scoped authorization |
| Inspector | Certified | host + extension pipeline |
| Module Loading | Certified | deterministic bootstrap + validation |
