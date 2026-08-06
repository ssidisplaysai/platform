# 22 Risk And Complexity

Risk assessment scale:

- Likelihood: Low, Medium, High
- Impact: Low, Medium, High

1. Quantity-model complexity
- Likelihood: Medium
- Impact: High
- Mitigation: explicit quantity equations, unit compatibility rules, property testing.
- Evidence required: quantity invariants and conversion tests.
- Certification implications: high relevance to correctness evidence.

2. Concurrency risk
- Likelihood: High
- Impact: High
- Mitigation: expected-version checks and conflict classifications.
- Evidence: stale-write and race tests.
- Certification implications: mandatory conflict-path evidence.

3. Ledger integrity risk
- Likelihood: Medium
- Impact: High
- Mitigation: append-only enforcement and immutable audit links.
- Evidence: append-only and anti-mutation tests.
- Certification implications: critical traceability requirement.

4. Reservation/allocation race risk
- Likelihood: High
- Impact: High
- Mitigation: coordinated atomic updates and idempotency.
- Evidence: race and over-commit rejection tests.
- Certification implications: critical commitment correctness.

5. Transfer atomicity risk
- Likelihood: Medium
- Impact: High
- Mitigation: coordinated source and destination compare-on-write.
- Evidence: transfer atomicity and rollback tests.
- Certification implications: key inventory consistency proof.

6. Serial uniqueness risk
- Likelihood: Medium
- Impact: High
- Mitigation: unique indexes and one-active-location invariant.
- Evidence: double-assignment negative tests.
- Certification implications: traceability control requirement.

7. Lot traceability risk
- Likelihood: Medium
- Impact: Medium
- Mitigation: lot-linked movement and ledger evidence.
- Evidence: lot chain continuity tests.
- Certification implications: quality/compliance support.

8. Expiration risk
- Likelihood: Medium
- Impact: Medium
- Mitigation: explicit expiration state transitions and policy checks.
- Evidence: expiration/quarantine tests.
- Certification implications: operational safety evidence.

9. Reference availability risk
- Likelihood: Medium
- Impact: Medium
- Mitigation: validator caching policy and fail-closed mandatory reference handling.
- Evidence: reference outage and stale-cache tests.
- Certification implications: boundary compliance evidence.

10. Persistence growth risk
- Likelihood: Medium
- Impact: Medium
- Mitigation: partitioned files and checkpoint strategy.
- Evidence: growth and replay performance tests.
- Certification implications: sustainability evidence.

11. Snapshot strategy risk
- Likelihood: Low
- Impact: Medium
- Mitigation: recomputable projections and checkpoint verification.
- Evidence: replay parity tests.
- Certification implications: recovery determinism proof.

12. GSP adoption risk
- Likelihood: Medium
- Impact: Medium
- Mitigation: explicit shared-consumption mapping and anti-duplication controls.
- Evidence: GSP integration conformance tests.
- Certification implications: consumer-boundary proof.

13. Product contract compatibility risk
- Likelihood: Medium
- Impact: High
- Mitigation: strict Product reference validation and adapter version policy.
- Evidence: compatibility and tenant mismatch tests.
- Certification implications: cross-platform integrity requirement.

14. Mission Control observability risk
- Likelihood: Low
- Impact: Medium
- Mitigation: read-only observation channels and mutation prohibition tests.
- Evidence: mission control isolation tests.
- Certification implications: governance boundary proof.