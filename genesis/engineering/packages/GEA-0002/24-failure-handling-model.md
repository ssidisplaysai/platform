# 24 Failure Handling Model

## Required Failure Cases
1. Missing required source
2. Invalid manifest
3. Invalid JSON
4. Broken reference
5. Duplicate identifier
6. Conflicting ownership
7. Conflicting authority
8. Missing lifecycle
9. Missing certification
10. Missing validation
11. Unresolved package
12. Unresolved artifact
13. Orphan capability
14. Circular dependency
15. Circular ownership
16. Ambiguous source precedence
17. Unsupported file format
18. Partial repository access

## Fail-Closed Rules
1. Constitutional authority claims fail closed.
2. Ownership claims fail closed.
3. Certification claims fail closed.
4. Authoritative relationship claims fail closed.
5. Release-state claims fail closed when evidence is STALE_BLOCKING, EXPIRED, or INVALID.
6. Stale evidence may not silently support authoritative claims.

## Freshness Failure Mapping
1. STALE_NON_BLOCKING on non-critical claims: warning path with downgraded result.
2. STALE_NON_BLOCKING on certification-critical claims: error path.
3. STALE_BLOCKING on constitutional, ownership, certification, authoritative relationship, or release-state claims: fail-closed error or fatal path.
4. EXPIRED and INVALID evidence on critical claims: fail-closed fatal path unless policy explicitly scopes to error.

## Diagnostic Expectations
1. Every failure emits severity, evidence, and remediation guidance.
2. Fatal and error outcomes are freeze-blocking unless formally waived by governance policy.
3. Diagnostics include affected stage and affected scope for localized versus global blocking.
