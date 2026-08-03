# 10 Final Risk Assessment

## Risk Register

1. Persistence corruption
- Severity: High
- Likelihood: Medium
- Impact: Recovery ambiguity or loss of trust in persisted workflow state
- Existing controls: typed store model, corrupt-checkpoint visibility counter, independent tests for corruption signal
- Residual risk: Medium
- Certification effect: Non-blocking if corruption is detected and operational controls exist

2. Multi-node contention
- Severity: High
- Likelihood: Medium (if deployed multi-writer)
- Impact: concurrent authoritative state divergence
- Existing controls: explicit single-writer readiness declaration; process-local lock + persistence version checks
- Residual risk: Medium
- Certification effect: Non-blocking for single-writer deployment model

3. Duplicate execution
- Severity: High
- Likelihood: Low to Medium
- Impact: repeated workflow side effects
- Existing controls: persisted command-key dedupe, duplicate command metric
- Residual risk: Low to Medium
- Certification effect: Non-blocking for covered command paths

4. Stale state writes
- Severity: High
- Likelihood: Medium
- Impact: overwrite of newer authoritative state
- Existing controls: expectedVersion checks and stale rejection
- Residual risk: Low
- Certification effect: Non-blocking

5. Compensation failure
- Severity: Medium
- Likelihood: Medium
- Impact: incomplete rollback
- Existing controls: compensation retry and failure recording
- Residual risk: Medium
- Certification effect: Non-blocking with visibility

6. Timeout drift
- Severity: Medium
- Likelihood: Medium
- Impact: delayed timeout handling
- Existing controls: timeout records persisted and classified state handling
- Residual risk: Medium
- Certification effect: Non-blocking

7. Retry accumulation
- Severity: Medium
- Likelihood: Medium
- Impact: backlog and latency
- Existing controls: retry persistence, clear-on-resolution, retry metrics
- Residual risk: Medium
- Certification effect: Non-blocking

8. Lifecycle event delivery failure
- Severity: Medium
- Likelihood: Medium
- Impact: downstream telemetry gaps
- Existing controls: lifecycle publish failure metric + audit visibility
- Residual risk: Low to Medium
- Certification effect: Non-blocking with visibility

9. Audit loss
- Severity: Medium
- Likelihood: Low to Medium
- Impact: reduced forensic traceability
- Existing controls: audit persistence failure counter and in-memory audit writer
- Residual risk: Medium
- Certification effect: Non-blocking with warning

10. Metrics inconsistency
- Severity: Medium
- Likelihood: Low
- Impact: operational misread
- Existing controls: persisted metrics snapshots and gauge refresh from persisted state
- Residual risk: Low
- Certification effect: Non-blocking

11. Long-running workflow state growth
- Severity: Medium
- Likelihood: Medium
- Impact: storage growth and degraded operational performance
- Existing controls: none in workflow core beyond persistence
- Residual risk: Medium to High
- Certification effect: Non-blocking for current scope, requires operational governance

12. Restart re-execution ambiguity for recovered running instances
- Severity: High
- Likelihood: Medium
- Impact: potential replay of previously completed step after recovery and resume
- Existing controls: recovery visibility marker (workflow_recovered_from_running_state)
- Residual risk: High
- Certification effect: Blocking for unconditional certification
