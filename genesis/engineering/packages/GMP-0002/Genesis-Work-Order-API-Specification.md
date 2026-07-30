# Genesis Work Order API Specification

## Endpoints
- GET /api/work-orders
- POST /api/work-orders
- GET /api/work-orders/{id}
- PATCH /api/work-orders/{id}
- GET /api/work-orders/search
- POST /api/work-orders/from-order/{orderId}
- GET /api/work-orders/{id}/audit
- GET /api/work-orders/{id}/revisions
- POST /api/work-orders/{id}/revisions
- GET /api/work-orders/{id}/timeline
- POST /api/work-orders/{id}/release
- POST /api/work-orders/{id}/pause
- POST /api/work-orders/{id}/cancel

## Response Contract Patterns
- Success payloads return workOrder or collection records
- Validation failures return issues arrays with HTTP 400
- Unauthorized and forbidden requests return 401 or 403
- Missing records return 404 where applicable

## Scope Headers
- x-gcp-roles
- x-gcp-organization-id
- x-gcp-site-id (optional)
- x-gcp-actor (optional actor attribution)
