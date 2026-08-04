# 11 Risk Assessment

Overall risk posture: MODERATE-LOW

Risk register:

- C1
- Title: Merge idempotency keys are process-local
- Severity: MEDIUM
- Evidence: src/platform/contact/services/ContactMergeService.ts uses in-memory map for idempotency cache
- Impact: retried merge request after process restart may re-execute merge path
- Remediation: persist idempotency keys in durable store with TTL and conflict-safe lookup
- Blocking: No

- C2
- Title: Contact observability routes lack explicit authorization resolver check
- Severity: MEDIUM
- Evidence: src/app/api/gop/contact/health/route.ts and src/app/api/gop/contact/metrics/route.ts gate on session presence only
- Impact: session-authenticated principals may access observability without policy-based action evaluation
- Remediation: apply resolver/authorization service decision for metrics:view and health:view route actions
- Blocking: No

Accepted risks:

- Both conditions accepted for this certification cycle with tracked remediation.
