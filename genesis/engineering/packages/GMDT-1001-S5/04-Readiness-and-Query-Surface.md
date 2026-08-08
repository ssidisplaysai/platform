# 04 Readiness and Query Surface

Implemented query surface:
- ManufacturingMaterialQueryService

Behavior:
- Lists material requirements by work order.
- Supports deterministic filtering by routing step and operation references.
- Projects material readiness as:
  - requirementsReady
  - inventoryMaterialsReady
  - materialsReady
  - requirementCount

Read model intent:
- Read-only bounded query behavior.
- Stable ordering for deterministic replay and auditability.
