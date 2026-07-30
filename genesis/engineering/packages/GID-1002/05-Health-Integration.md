# Health and Mission Control Integration

## Health Endpoint

- Route: src/app/api/gop/authentication/health/route.ts
- Method: GET
- Payload:
  - capability: identity.authentication
  - health snapshot from GenesisAuthenticationService

## Metrics Endpoint

- Route: src/app/api/gop/authentication/metrics/route.ts
- Method: GET
- Payload:
  - capability: identity.authentication
  - metrics counters
  - provider health summary

## GOP Metrics Snapshot Extension

- Extended src/lib/gop/events-api.ts response payload with:
  - authentication
  - authenticationProviders

## Integration Rationale

The repository currently contains GOP operational surfaces and no dedicated EHC/GMC routes. Integration was therefore implemented through GOP-compatible API exposure and existing metrics response surface extension.
