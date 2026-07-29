# Genesis Sales Order API

## Endpoint Surface
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/{id}`
- `PATCH /api/orders/{id}`
- `GET /api/orders/search`
- `GET /api/orders/{id}/audit`
- `GET /api/orders/{id}/revisions`
- `POST /api/orders/{id}/revisions`
- `GET /api/orders/{id}/timeline`
- `POST /api/orders/{id}/approve`
- `POST /api/orders/{id}/release`
- `POST /api/orders/{id}/cancel`
- `POST /api/orders/from-quote/{quoteId}`

## Scope and Authorization
- Organization scope required: `x-gcp-organization-id`
- Optional site scope: `x-gcp-site-id`
- Actor attribution header: `x-gcp-actor`
- Role authorization via `x-gcp-roles`

## Response Contract
- 200/201 on success
- 400 on validation failures (`issues`)
- 401 on missing role context
- 403 on permission/scope violations
- 404 on missing or out-of-scope records

## Conversion Behavior
`POST /api/orders/from-quote/{quoteId}`:
- Requires accepted or already-converted quote.
- Preserves quote lineage fields in created order.
- Prevents duplicate order creation for same quote.
