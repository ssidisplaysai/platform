# 02 Architecture

Implemented under:

- src/platform/documents/contracts
- src/platform/documents/services
- src/platform/documents/runtime
- src/platform/documents/integration
- src/platform/documents/persistence
- src/platform/documents/index.ts

Mission Control integration:

- src/app/api/gop/documents/health/route.ts
- src/app/api/gop/documents/metrics/route.ts

Architecture properties:

- Service-only exposure
- File-backed durable state
- Fail-closed recovery validation
- Version compatibility guard (schema 1.0.0)
- Provider-neutral dependency integration
