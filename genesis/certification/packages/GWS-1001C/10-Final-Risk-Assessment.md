# 10 Final Risk Assessment

1. Risk: DST duplicate occurrence
- Severity: Medium
- Likelihood: Low
- Impact: Duplicate dispatch risk in ambiguous hour
- Existing controls: localRunKey ambiguity detection, duplicate skip policy, claim checks
- Residual risk: Low
- Certification effect: Acceptable

2. Risk: DST skipped occurrence
- Severity: Medium
- Likelihood: Low
- Impact: missed intended run near DST transitions
- Existing controls: deterministic recurrence scanning, ambiguity visibility metrics
- Residual risk: Low
- Certification effect: Acceptable

3. Risk: Clock drift
- Severity: Medium
- Likelihood: Medium
- Impact: dispatch timing skew
- Existing controls: Clock abstraction and deterministic calculations
- Residual risk: Medium
- Certification effect: Acceptable

4. Risk: Duplicate claim
- Severity: Medium
- Likelihood: Low
- Impact: duplicate worker ownership contention
- Existing controls: claimAtomic abstraction, idempotency key checks, conflict handling
- Residual risk: Low
- Certification effect: Acceptable

5. Risk: Claim starvation
- Severity: Low
- Likelihood: Low
- Impact: delayed execution for specific occurrences
- Existing controls: claim expiration and recoverExpiredClaims
- Residual risk: Low
- Certification effect: Acceptable

6. Risk: Restart duplicate dispatch
- Severity: Medium
- Likelihood: Low
- Impact: repeated message publication after restart
- Existing controls: persisted claims, occurrence identity, restart recovery path
- Residual risk: Low
- Certification effect: Acceptable

7. Risk: Corrupt persistence
- Severity: High
- Likelihood: Low
- Impact: invalid scheduler state load
- Existing controls: strict parse, record validation, corruption classification, degraded recovery
- Residual risk: Medium
- Certification effect: Acceptable

8. Risk: Partial write
- Severity: High
- Likelihood: Low
- Impact: inconsistent persisted state
- Existing controls: partial-state classification and invalid-record filtering
- Residual risk: Medium
- Certification effect: Acceptable

9. Risk: Messaging outage
- Severity: High
- Likelihood: Medium
- Impact: dispatch failure and schedule interruption
- Existing controls: retry policy and failure classification
- Residual risk: Medium
- Certification effect: Acceptable

10. Risk: Audit-store failure
- Severity: Medium
- Likelihood: Medium
- Impact: durable audit loss
- Existing controls: audit failure metric and in-memory failure visibility event
- Residual risk: Medium
- Certification effect: Acceptable

11. Risk: Retry exhaustion
- Severity: Medium
- Likelihood: Medium
- Impact: occurrence and schedule failure
- Existing controls: explicit retry exhaustion audit and dispatch failure handling
- Residual risk: Medium
- Certification effect: Acceptable

12. Risk: Missed-run accumulation
- Severity: Medium
- Likelihood: Medium
- Impact: backlog growth and delayed catch-up
- Existing controls: bounded due-run generation and missed-run policies
- Residual risk: Medium
- Certification effect: Acceptable

13. Risk: Multi-node contention
- Severity: High
- Likelihood: Medium
- Impact: non-atomic ownership across nodes if deployed beyond guarantee scope
- Existing controls: explicit single-writer readiness declaration
- Residual risk: Medium
- Certification effect: Acceptable only under declared deployment scope

14. Risk: Schedule version conflict
- Severity: Medium
- Likelihood: Low
- Impact: configuration inconsistency
- Existing controls: registry version checks and active-version conflict checks
- Residual risk: Low
- Certification effect: Acceptable

15. Risk: Long-lived schedule accumulation
- Severity: Medium
- Likelihood: Medium
- Impact: storage growth and performance degradation
- Existing controls: metrics visibility and operational governance controls
- Residual risk: Medium
- Certification effect: Acceptable
