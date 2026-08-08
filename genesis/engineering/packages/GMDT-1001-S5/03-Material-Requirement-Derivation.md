# 03 Material Requirement Derivation

Implemented service:
- MaterialRequirementService

Behavior:
- Derives required quantity per BOM line from planned quantity and quantity-per-unit.
- Validates duplicate BOM line keys and rejects non-deterministic duplicate payloads.
- Validates each required routing step exists in the execution routing topology.
- Produces deterministic ordering for requirement records.
- Writes requirement set and updates work order readiness projection flags.

Data integrity:
- Enforces tenant/work-order boundaries.
- Enforces expected-version checks for concurrent derivation attempts.
- Emits audit records for derivation events.
