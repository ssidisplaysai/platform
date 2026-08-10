# 02 Inventory Integration Service

File: src/platform/manufacturing/services/ManufacturingInventoryIntegrationService.ts

Responsibilities:
- Port-level mapping from integration responses to deterministic manufacturing domain failures
- Availability enforcement and insufficient stock rejection
- Reservation, allocation, issue, and return command orchestration
- Movement, lot, and serial validation with bounded authority
