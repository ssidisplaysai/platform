# 04 Material Consumption Orchestration

File: src/platform/manufacturing/services/MaterialConsumptionService.ts

Behavior:
- Deterministic idempotency by payload fingerprint
- Optional inventory movement/lot/serial validation before local mutation
- Explicit rejection when consumption exceeds issued or required policy
