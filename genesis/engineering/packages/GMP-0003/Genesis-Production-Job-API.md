# Genesis Production Job API

## Collection
- `GET /api/production-jobs`
- `POST /api/production-jobs`
- `GET /api/production-jobs/search?query=...`
- `POST /api/production-jobs/from-work-order/{workOrderId}`

## Aggregate
- `GET /api/production-jobs/{productionJobId}`
- `PATCH /api/production-jobs/{productionJobId}`
- `GET /api/production-jobs/{productionJobId}/timeline`
- `GET /api/production-jobs/{productionJobId}/audit`
- `GET /api/production-jobs/{productionJobId}/revisions`
- `POST /api/production-jobs/{productionJobId}/revisions`

## Lifecycle Commands
- `POST /api/production-jobs/{productionJobId}/release`
- `POST /api/production-jobs/{productionJobId}/pause` (supports start/pause/resume action mode)
- `POST /api/production-jobs/{productionJobId}/cancel`

## Auth Contract
- Role headers resolved via foundation auth parser.
- Organization/site boundary enforced via scope headers.
- Permission checks mapped to `production_jobs:*` capability set.

## Response Semantics
- `200/201` on success.
- `400` for invalid transitions or invalid payloads.
- `403` for authorization failures.
- `404` for unknown aggregate references.
