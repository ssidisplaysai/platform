# 07 Resource Readiness Service

Service: manufacturing.service.resource-readiness

Behaviors:
- Evaluates per-operation required resources from routing conditionInput
- Produces operation-level blocking reasons
- Synchronizes work-order resourcesReady using expected-version updates
