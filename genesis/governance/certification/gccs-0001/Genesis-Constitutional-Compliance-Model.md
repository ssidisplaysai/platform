# Genesis Constitutional Compliance Model

## Compliance States
- COMPLIANT
- COMPLIANT WITH CONDITIONS
- PARTIALLY COMPLIANT
- NON-COMPLIANT
- NOT APPLICABLE
- INSUFFICIENT EVIDENCE
- SUPERSEDED
- WITHDRAWN

## State Meanings
- COMPLIANT: All applicable clauses satisfy required thresholds.
- COMPLIANT WITH CONDITIONS: Clauses satisfy thresholds, but bounded conditions must be met and tracked.
- PARTIALLY COMPLIANT: Some applicable clauses satisfy thresholds; at least one material clause does not.
- NON-COMPLIANT: One or more critical or blocker clauses fail.
- NOT APPLICABLE: Clause is outside constitutional scope for target.
- INSUFFICIENT EVIDENCE: Clause cannot be decided due to missing admissible evidence.
- SUPERSEDED: Evaluation replaced by successor clause/version linkage.
- WITHDRAWN: Evaluation invalidated by authority withdrawal or procedural defect.

## Aggregation Rules
1. Any blocker clause failure yields NON-COMPLIANT unless the clause is NOT APPLICABLE.
2. Any INSUFFICIENT EVIDENCE on required clause yields Certification Deferred.
3. COMPLIANT WITH CONDITIONS requires explicit condition registry entries.
4. SUPERSEDED and WITHDRAWN states require successor or withdrawal references.

## Machine Reference
- [machine/compliance-states.json](machine/compliance-states.json)