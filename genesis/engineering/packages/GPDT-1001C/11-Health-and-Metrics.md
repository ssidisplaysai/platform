# 11 Health and Metrics

Health projection schema (conceptual):

1. status: HEALTHY | DEGRADED | FAILED
2. generatedAt
3. checks:
- persistence
- invariant-engine
- reference-validation
- provider-registry
- integration-ports
- audit-projection

Metrics projection schema (conceptual):

1. productTotal
2. variantTotal
3. bundleTotal
4. kitTotal
5. pricingDefinitionTotal
6. bomDefinitionTotal
7. activeProducts
8. deprecatedProducts
9. retiredProducts
10. versionConflictCount
11. invalidReferenceCount
12. invariantViolationCount
13. recoveryCount
14. auditEventCount

Metric semantics:

1. Metrics are observational projections, not canonical business ownership state.
2. Metrics must be deterministic from current persisted Product state and audit records.

Operational thresholds (guidance):

1. invariantViolationCount > 0 -> DEGRADED.
2. repeated persistence failures -> FAILED.
3. rising invalidReferenceCount -> DEGRADED and integration investigation required.

Exposure rules:

1. Health and metrics endpoints are authorization-gated.
2. Mission Control receives read-only observational payloads.
