# 11 Mission Control Integration

Mission Control behavior:
1. `/api/gop/notifications/health` returns capability, metadata, health, and readiness for notifications.
2. `/api/gop/notifications/metrics` returns capability, metadata, metrics, health, and readiness.
3. `src/lib/gop/events-api.ts` aggregates notification health and metrics into the main GOP metrics response.
4. Mission Control remains observability-only; it does not execute notification deliveries or mutate provider state directly.
