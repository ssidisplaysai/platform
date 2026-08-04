# 11 Mission Control Integration

## Routes
- `src/app/api/gop/contact/health/route.ts`
- `src/app/api/gop/contact/metrics/route.ts`

Both endpoints are observability-only and require GLW session.

## GOP Aggregate Compatibility
`src/lib/gop/events-api.ts` includes contact fields in aggregate metrics payload:
- `contactMetadata`
- `contactMetrics`
- `contactHealth`

Existing GOP fields for other platforms remain preserved.

## Regression Guarding
Mission-control tests validate contact endpoint behavior and aggregate contact field integration alongside existing authorization/messaging/workflow surfaces.
