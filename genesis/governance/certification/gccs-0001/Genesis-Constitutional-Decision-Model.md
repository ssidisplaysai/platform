# Genesis Constitutional Decision Model

## Decision States
- Certified
- Certified With Conditions
- Not Certified
- Certification Deferred
- Certification Withdrawn
- Certification Superseded
- Certification Revoked

## Decision Criteria
- Certified: All required clauses COMPLIANT with minimum High confidence and no blocker severity failures.
- Certified With Conditions: Required clauses pass, but binding conditions remain open and tracked.
- Not Certified: One or more required clauses are NON-COMPLIANT.
- Certification Deferred: Required clause set contains INSUFFICIENT EVIDENCE.
- Certification Withdrawn: Decision invalidated due to procedural or authority defect.
- Certification Superseded: Decision replaced by successor decision entry.
- Certification Revoked: Previously certified state revoked due to new non-compliance evidence.

## Decision Protocol
1. Validate jurisdiction and scope.
2. Validate evidence admissibility.
3. Evaluate clauses.
4. Determine compliance aggregation.
5. Apply severity and confidence thresholds.
6. Issue decision state.
7. Record traceability and lifecycle identifiers.

## Independence Rule
Certification decision authority is independent from implementation ownership.

## Machine Reference
- [machine/decision-states.json](machine/decision-states.json)
- [machine/decision-registry.schema.json](machine/decision-registry.schema.json)