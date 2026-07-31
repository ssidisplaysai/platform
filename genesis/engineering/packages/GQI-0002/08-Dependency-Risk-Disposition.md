# Dependency Risk Disposition

## Before / After Dependency Baseline

- Before (GQI-0001): 34 vulnerabilities (33 high, 1 moderate, 0 critical)
- After (GQI-0002): 34 vulnerabilities (33 high, 1 moderate, 0 critical)

## Disposition

1. Package-level remediation in this work order
- No forced upgrades applied.
- No uncontrolled major-version risk introduced.
- Dependency posture unchanged by design for this remediation scope.

2. Severity policy classification
- Critical: none
- High: 33 (deferred)
- Moderate: 1 (deferred)

3. Exploitability and runtime risk
- Requires dedicated security hardening work order with package-level triage and test-backed upgrade sequencing.

4. Ownership recommendation
- Assign dependency risk closure to platform engineering security stream with staged non-breaking updates and regression validation.

## Conclusion

Dependency risk does not block GQI-0002 static-gate closure because no dependency directly blocks canonical typecheck reliability objective.
