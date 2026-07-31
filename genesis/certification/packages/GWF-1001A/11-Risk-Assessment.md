# Risk Assessment

## Risk Register

1. In-memory workflow state
- Severity: High
- Likelihood: High
- Impact: Instance loss on restart
- Evidence: WorkflowEngine uses in-memory instance Map
- Mitigation: Introduce durable workflow-state store and recovery hydration
- Certification Effect: Condition required

2. Restart loss
- Severity: High
- Likelihood: High
- Impact: Running/paused workflows disappear after process restart
- Evidence: No restart recovery path in workflow module
- Mitigation: Durable state + startup recovery coordinator
- Certification Effect: Condition required

3. Checkpoint loss
- Severity: High
- Likelihood: High
- Impact: Resume continuity loss
- Evidence: CheckpointService is in-memory only
- Mitigation: Persist checkpoints with versioned schema
- Certification Effect: Condition required

4. Timeout loss
- Severity: Medium
- Likelihood: Medium
- Impact: Timeout history non-durable and late side effects can continue
- Evidence: TimeoutManager only rejects promise; no cancellation token model
- Mitigation: Cancellation signaling and durable timeout records
- Certification Effect: Condition required

5. Retry loss
- Severity: Medium
- Likelihood: High
- Impact: Retry attempts and backoff state lost on restart
- Evidence: Retry counters are in-process state
- Mitigation: Durable retry ledger
- Certification Effect: Condition required

6. Compensation failure
- Severity: High
- Likelihood: Medium
- Impact: Partial rollback risk if compensation action throws
- Evidence: No dedicated compensation failure state/audit escalation path
- Mitigation: Durable compensation status and failure escalation
- Certification Effect: Condition required

7. Duplicate execution
- Severity: Medium
- Likelihood: Medium
- Impact: Repeated side effects from repeated execute calls
- Evidence: No lock/lease guard around same-instance concurrent execution
- Mitigation: Instance-level concurrency guard and idempotency policy
- Certification Effect: Condition required

8. Concurrent transition conflicts
- Severity: Medium
- Likelihood: Medium
- Impact: Race on currentStepId/state mutation
- Evidence: Mutable in-memory instance state without synchronization
- Mitigation: Compare-and-set state versioning or distributed lock
- Certification Effect: Condition required

9. Invalid state mutation
- Severity: Medium
- Likelihood: Low
- Impact: Incorrect lifecycle metrics and state drift
- Evidence: State writes are imperative and not validated by centralized state machine object
- Mitigation: Explicit state transition guard matrix
- Certification Effect: Non-blocking condition

10. Context growth
- Severity: Medium
- Likelihood: Medium
- Impact: Memory pressure and payload bloat
- Evidence: Context variables merge without size limit
- Mitigation: Variable size limits and schema validation
- Certification Effect: Non-blocking condition

11. Long-running workflow accumulation
- Severity: Medium
- Likelihood: Medium
- Impact: Memory retention growth and degraded node stability
- Evidence: In-memory maps retain instances/checkpoints/history without eviction policy
- Mitigation: Archival/retention lifecycle and durable backend
- Certification Effect: Condition required

12. Subscriber or messaging failure
- Severity: Medium
- Likelihood: Medium
- Impact: Lost lifecycle telemetry visibility
- Evidence: Lifecycle publish failures are swallowed
- Mitigation: Publish-failure counters/audit and retry policy
- Certification Effect: Condition required

13. Observability gaps
- Severity: Medium
- Likelihood: Medium
- Impact: Misleading operational signals
- Evidence: runningInstances/pausedInstances metrics are increment-only counters rather than active gauges
- Mitigation: Gauge semantics and recalculation from authoritative instance states
- Certification Effect: Condition required

## Risk Verdict

Material risks are concentrated in durability, restart recovery, concurrency control, and observability hardening, not in foundational architecture correctness.
