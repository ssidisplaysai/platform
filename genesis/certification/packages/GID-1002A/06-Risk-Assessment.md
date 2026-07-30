# Risk Assessment

## Risk Register

1. Risk ID: GID-1002A-R1
- Title: Non-durable session revocation state
- Severity: High
- Likelihood: Medium
- Evidence: src/platform/identity/session/glw-session-codec.ts line 32 and line 116.
- Production Blocking: Yes for strict multi-node production.
- Mitigation: Replace in-memory revoked set with shared durable revocation store and add restart/multi-node tests.

2. Risk ID: GID-1002A-R2
- Title: SessionService port semantic incompleteness
- Severity: Medium
- Likelihood: Medium
- Evidence: src/platform/identity/session/session-service.ts lines 23 and 42-45.
- Production Blocking: No for current auth token path, Yes for future consumers of SessionService port contract.
- Mitigation: Implement createSession/revokeSession with full semantic parity and tests.

3. Risk ID: GID-1002A-R3
- Title: In-memory audit sink without durability
- Severity: Medium
- Likelihood: High
- Evidence: src/platform/identity/services/authentication-audit-writer.ts lines 12-20 and 24.
- Production Blocking: No for immediate auth flow, Yes for strict audit retention/compliance environments.
- Mitigation: Integrate durable audit sink and retrieval interface with verification tests.

4. Risk ID: GID-1002A-R4
- Title: Async signature compatibility drift for validateGlwCredentials
- Severity: Low
- Likelihood: Low
- Evidence: src/lib/glw/auth.ts line 15 and src/app/glw/login/actions.ts line 18.
- Production Blocking: No in current repository usage.
- Mitigation: Keep adapter facade documentation and add static tests for callsite expectations.

## Residual Risk Posture

Overall residual risk is moderate with one high-severity production condition tied to revocation durability.
