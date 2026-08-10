# 06 Material Requirement Execution State

File: src/platform/manufacturing/services/MaterialRequirementService.ts

Added execution-state behavior:
- Reservation and allocation reference tracking
- Issued, consumed, returned quantity mutation APIs
- Status derivation (READY, PARTIALLY_ISSUED, ISSUED, PARTIALLY_CONSUMED, CONSUMED, RETURNED)
- Work-order inventoryMaterialsReady refresh from requirement truth
