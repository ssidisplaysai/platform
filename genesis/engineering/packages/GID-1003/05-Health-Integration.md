# GID-1003 Health Integration

## New Endpoints
- `GET /api/gop/authorization/health`
- `GET /api/gop/authorization/metrics`

## Health Model
Authorization health returns:
- Overall status (`HEALTHY`, `DEGRADED`, `CRITICAL`).
- Policy check with active policy count.
- Cache check with size/hit/miss counts.
- Metrics check with evaluated/denied counts.

## Mission Control Expansion
- Existing GOP metrics payload now includes:
  - `authorizationMetrics`
  - `authorizationHealth`

## Operational Considerations
- Health can be computed with a runtime context to include policy count.
- Audit failures are non-fatal by design to preserve decision path availability.
