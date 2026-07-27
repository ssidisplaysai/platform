# GBA-0002 API Contracts

## Endpoints
- `GET /api/gba/operations/dashboard`
- `GET /api/gba/operations/work-orders`
- `POST /api/gba/operations/work-orders`
- `GET /api/gba/operations/inventory`
- `GET /api/gba/operations/purchasing`
- `GET /api/gba/operations/warehouse`
- `GET /api/gba/operations/shipping`
- `GET /api/gba/operations/capacity`
- `GET /api/gba/operations/kpis`
- `GET /api/gba/operations/recommendations`
- `POST /api/gba/operations/recommendations/review`
- `GET /api/gba/operations/health`

## Auth
All endpoints require:
- Active GLW session
- GOP authorization action mapped to route

## Error Contracts
- `401`: session missing
- `403`: action unauthorized
- `400`: invalid payload (mutations)

## Success Contracts
- `200`: reads
- `201`: create/review mutations
