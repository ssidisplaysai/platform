# Genesis Quote API

## Root Routes
- GET /api/quotes
- POST /api/quotes
- GET /api/quotes/search

## Quote Detail Routes
- GET /api/quotes/{quoteId}
- PATCH /api/quotes/{quoteId}
- GET /api/quotes/{quoteId}/audit
- GET /api/quotes/{quoteId}/revisions
- POST /api/quotes/{quoteId}/revisions

## Line Routes
- POST /api/quotes/{quoteId}/lines
- PATCH /api/quotes/{quoteId}/lines/{lineId}
- DELETE /api/quotes/{quoteId}/lines/{lineId}

## Lifecycle Routes
- POST /api/quotes/{quoteId}/submit
- POST /api/quotes/{quoteId}/approve
- POST /api/quotes/{quoteId}/reject
- POST /api/quotes/{quoteId}/withdraw
- POST /api/quotes/{quoteId}/present
- POST /api/quotes/{quoteId}/accept
- POST /api/quotes/{quoteId}/cancel
- POST /api/quotes/{quoteId}/expire
- POST /api/quotes/{quoteId}/convert

## Auth And Scope
- Role permission checks are enforced per route.
- organization/site scope is enforced via x-gcp-organization-id and optional x-gcp-site-id.
- expectedVersion can be supplied for optimistic concurrency where applicable.
