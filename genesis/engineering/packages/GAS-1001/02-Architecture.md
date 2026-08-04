# 02 Architecture

Implemented under:

- src/platform/assets/contracts
- src/platform/assets/persistence
- src/platform/assets/services
- src/platform/assets/runtime
- src/platform/assets/integration
- src/platform/assets/index.ts

Mission Control integration:

- src/app/api/gop/assets/health/route.ts
- src/app/api/gop/assets/metrics/route.ts

Architecture properties:

- Service-only exposure
- File-backed durable state
- Fail-closed recovery validation
- Deterministic observability payloads
