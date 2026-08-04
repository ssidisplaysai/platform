# 02 Architecture

Module layout:
- src/platform/organization/contracts
- src/platform/organization/services
- src/platform/organization/persistence
- src/platform/organization/integration
- src/platform/organization/audit
- src/platform/organization/metrics
- src/platform/organization/health
- src/platform/organization/runtime

Design properties:
- Provider-neutral persistence contracts
- Runtime composition pattern aligned with existing platform modules
- Observability-first integration for Mission Control
- No ownership overlap with identity/auth/messaging/workflow/scheduling/notifications/ai
