# 16 Validation Architecture

## Validation Gates
1. Package completeness
2. Entity completeness
3. Relationship completeness
4. Ownership completeness
5. Traceability completeness
6. Dependency integrity
7. Lifecycle integrity
8. Boundary integrity
9. Constitutional integrity
10. Governance integrity
11. Validation integrity
12. Certification integrity
13. Terminology consistency
14. Identifier uniqueness
15. Cross-reference integrity
16. Broken path detection
17. Duplicate detection
18. Cycle detection
19. Orphan detection
20. Domain coverage
21. Query answerability
22. Navigation completeness
23. Impact-analysis completeness
24. Repository-impact integrity
25. Stale-evidence policy completeness
26. Query contract matrix completeness
27. Output contract completeness
28. Compatibility criteria completeness
29. Traceability scope clarity
30. Parser precedence completeness
31. Diagnostic ordering completeness
32. Validation-stage blocking completeness

## Validation Result Schema
Each result includes:
1. ruleId
2. scope
3. severity
4. evidence
5. status
6. blockingClassification
7. remediationGuidance
8. stage
9. affectedScope

## Traceability Scope Validation
1. TRACE-PKG-001: architecture package source traceability.
2. TRACE-ARCH-001: traceability architecture completeness.
3. TRACE-RUNTIME-001: compiled node and edge provenance.
4. TRACE-OUTPUT-001: generated Atlas traceability integrity.

Expected architecture-only state:
1. TRACE-PKG-001: PASS when package source traceability is complete.
2. TRACE-ARCH-001: PASS when architecture requirements are complete.
3. TRACE-RUNTIME-001: NOT APPLICABLE until compiler implementation and compiled Atlas outputs exist.
4. TRACE-OUTPUT-001: NOT APPLICABLE until generated Atlas outputs exist.

## Stage-Aware Blocking Link
1. Validation rules must map to stage semantics defined in diagnostic severity model.
2. ATLAS_VALIDATION success requires zero unresolved blocking FATAL and ERROR outcomes in validation scope.

## Status Values
1. PASS
2. PARTIAL
3. FAIL
4. NOT APPLICABLE
