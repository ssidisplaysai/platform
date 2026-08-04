# 10 Mission Control Integration

Mission Control observability routes implemented:

- src/app/api/gop/assets/health/route.ts
- src/app/api/gop/assets/metrics/route.ts

Authorization boundary:

- Explicit route authorization via lib/gop/asset-observability-authorization.ts
- Deterministic denied metrics surfaced for denied requests
