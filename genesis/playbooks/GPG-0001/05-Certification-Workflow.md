# 05 Certification Workflow

## Purpose

Issue independent certification decisions based on validated evidence, explicit condition logic, and constitutional boundaries.

## Entry criteria

1. Engineering validation complete.
2. Independent evidence package available.
3. Certification authority and decision rules declared.

## Workflow steps

1. Verify baseline commits and ancestry.
2. Reassess architecture, boundaries, and ownership.
3. Execute required validation commands or confirm independent evidence freshness.
4. Build condition matrix with severity, remediation, and blocking status.
5. Issue exactly one certification decision.

## Expected artifacts

1. Certification package under genesis/certification/packages/<work-order>/.
2. Condition matrix and risk assessment.
3. Final certification decision record.

## Typical decisions

1. CERTIFIED
2. CERTIFIED WITH CONDITIONS
3. NOT CERTIFIED

## Exit criteria

1. Decision issued with evidence.
2. Conditions are explicit and actionable.
3. Non-certification work is not mixed into certification commit.

## Success criteria

1. Independence preserved.
2. Decision traceability complete.
3. Follow-on work orders clearly defined when conditions remain.
