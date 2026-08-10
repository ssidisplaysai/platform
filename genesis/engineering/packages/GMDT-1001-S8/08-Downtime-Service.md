# 08 Downtime Service

Service: manufacturing.service.downtime

Behaviors:
- Start downtime with duplicate-active protection by context
- End downtime with timestamp ordering checks
- Duration computed deterministically in minutes
- Query by work order, operation, and tenant
