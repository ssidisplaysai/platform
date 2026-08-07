# 20 Condition Matrix

GIDT-CERT-C001
- source finding: GIDT-V-F001
- description: Optional/live validator breadth across all supported foreign reference categories has less direct execution evidence than mandatory Product validation paths.
- severity: Low
- evidence: bounded optional-reference degradation and observability behavior are validated, but enterprise validators for all supported foreign categories are not yet fully available for integrated execution.
- required remediation: when those external platforms or validators become available, execute success and failure/degradation paths through Inventory bounded contracts per validator family.
- blocking status: Non-blocking
- recommended owner: Inventory Platform Engineering
- next maturity gate where closure is required: enterprise cross-platform integration certification for the corresponding external validator families

GIDT-CERT-C002
- source finding: GIDT-V-F002
- description: DUPLICATE_MOVEMENT and DUPLICATE_MOVEMENT_ID both exist in the classification union, while runtime duplicate-movement behavior deterministically uses DUPLICATE_MOVEMENT_ID.
- severity: Low
- evidence: runtime output, audit behavior, health, metrics, tests, persisted state, and consumer-visible behavior do not surface conflicting semantics.
- required remediation: remove or harmonize the overlapping symbol in a future non-functional taxonomy cleanup without altering runtime behavior.
- blocking status: Non-blocking
- recommended owner: Inventory Platform Engineering
- next maturity gate where closure is required: next taxonomy cleanup or prior to any externalized public error-code contract freeze
