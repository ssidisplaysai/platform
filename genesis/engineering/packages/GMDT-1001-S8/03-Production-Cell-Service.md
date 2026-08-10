# 03 Production Cell Service

Service: manufacturing.service.production-cell

Behaviors:
- Register cell tied to an existing work center
- Capacity validation and deterministic listing
- Work center back-reference maintained via attachProductionCell
- Tenant and idempotency protections
