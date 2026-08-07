# 21 Finding and Condition Matrix

GIDT-V-F001
- category: External reference validation evidence breadth
- description: Mandatory Product and bounded optional reference behaviors are validated, but optional/live validator breadth across all supported foreign reference categories has less direct execution evidence than Product-focused paths.
- severity: Low
- evidence: tests/inventory/gidt-1001-s7-external-reference-validation.test.ts and tests/inventory/gidt-1001-s8-observability-mission-control.test.ts validate fail-closed mandatory behavior, optional degradation, metrics, and audit evidence.
- blocking status: Non-blocking
- required remediation: expand optional/live validator evidence when additional integrated validators become available
- recommended owner: Inventory Platform Engineering

GIDT-V-F002
- category: Failure taxonomy naming overlap
- description: DUPLICATE_MOVEMENT and DUPLICATE_MOVEMENT_ID both exist in the failure-classification union.
- severity: Low
- evidence: src/platform/inventory/contracts/types.ts includes both symbols; runtime duplicate-movement rejection currently uses DUPLICATE_MOVEMENT_ID deterministically.
- blocking status: Non-blocking
- required remediation: normalize naming in a future non-functional cleanup without changing semantics
- recommended owner: Inventory Platform Engineering

Blocking findings recorded: none
