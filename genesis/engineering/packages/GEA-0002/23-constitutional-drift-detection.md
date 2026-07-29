# 23 Constitutional Drift Detection

## Drift Detection Scope
1. Frozen source modification
2. Ownership mismatch
3. Capability redefinition
4. Governance conflict
5. Program status mismatch
6. Package lifecycle mismatch
7. Release-record mismatch
8. Certification mismatch
9. Traceability mismatch
10. Boundary violation
11. Terminology divergence
12. Unsupported authoritative claim
13. Missing constitutional ancestry
14. Freshness status mismatch between governing and governed evidence
15. Unsupported stale authoritative claim

## Drift Output Contract
1. driftStatus: NO_CONSTITUTIONAL_DRIFT_DETECTED or CONSTITUTIONAL_DRIFT_DETECTED
2. driftFindings with severity, evidence, impacted entities, and remediation
3. driftProvenance linking each finding to source and rule

## Severity Rules
1. Drift with constitutional conflict is ERROR or FATAL.
2. Drift with incomplete evidence but no direct conflict is WARNING.
3. Drift output is mandatory for freeze-readiness assessment.
4. Drift from stale authoritative claims in critical classes is at least ERROR.
