# Risk Assessment

## Residual Risk Summary

Overall residual risk: LOW to MODERATE.

## Risk Register

1. R1: Repository-wide typecheck gate fails on unresolved generator template placeholders.
- Evidence: `npx tsc --noEmit` reports 333 errors in `tools/genesis/templates/entity/*.template.ts`.
- Scope attribution: External to GID-1003 implementation.
- Impact: Reduces confidence in global static gate for future unrelated changes.
- Likelihood: High (current state).
- Severity: Moderate.
- Certification classification: Non-blocking condition.

2. R2: Authorization audit writer is intentionally fail-open on sink errors.
- Evidence: `AuthorizationAuditWriter.write` catches and suppresses sink exceptions.
- Impact: Potential transient audit loss during sink outage.
- Likelihood: Medium.
- Severity: Low to Moderate.
- Certification classification: Accepted design trade-off for availability at this stage; monitor operationally.

3. R3: Policy mapping depends on stable conversion from GOP policy catalog.
- Evidence: Mapping in `src/platform/gop/auth/authorization.ts` converts allow/deny and scope fields to identity policy shape.
- Impact: Incorrect future catalog changes could alter behavior if mapping drifts.
- Likelihood: Low.
- Severity: Moderate.
- Mitigation: Existing compatibility tests and boundary tests currently pass.

## Risk Conclusion

No blocking security or compatibility risks identified for initial authorization certification. One non-blocking governance condition is recorded.
