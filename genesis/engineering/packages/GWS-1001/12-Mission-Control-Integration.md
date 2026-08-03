# 12 Mission Control Integration

## Endpoints Added

1. src/app/api/gop/scheduling/health/route.ts
2. src/app/api/gop/scheduling/metrics/route.ts

## Shared Metrics Surface Update

Updated:
- src/lib/gop/events-api.ts

Added scheduling payload sections:
1. schedulingMetadata
2. schedulingMetrics
3. schedulingHealth
4. schedulingReadiness

## Control Boundary

Endpoints are observability-only and do not expose mutable scheduling administration actions.
