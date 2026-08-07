# 16 Failure Taxonomy Certification

Failure-taxonomy certification result: PASS WITH CONDITION

Disposition of GIDT-V-F002:
- classification: accepted naming debt
- determination: DUPLICATE_MOVEMENT and DUPLICATE_MOVEMENT_ID do not create real ambiguity in runtime output, audit evidence, health, metrics, integration consumers, test assertions, persisted state, or public contract behavior because runtime duplicate-movement rejection deterministically uses DUPLICATE_MOVEMENT_ID
- closure criteria: remove or harmonize the unused overlapping symbol in a future non-functional taxonomy cleanup without changing runtime semantics
