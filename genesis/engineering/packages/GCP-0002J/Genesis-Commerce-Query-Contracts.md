# Genesis Commerce Query Contracts

## Query Contract Principles
1. Queries are read-only.
2. Queries never mutate aggregate state.
3. Queries are authorization-aware and scope-aware.
4. Query responses are schema-versioned.

## Canonical Query Contract Families
1. Registry Queries
- List Orders
- List Quotes
- Search Orders
- Search Quotes

2. Detail Queries
- Get Order
- Get Quote

3. Audit and Revision Queries
- Get Order Audit
- Get Quote Audit
- Get Order Revisions
- Get Quote Revisions

4. Timeline Queries
- Get Order Timeline
- Get Quote Timeline

## Query Envelope
```yaml
QueryEnvelope:
  queryId: string
  contractVersion:
    major: integer
    minor: integer
    patch: integer
  queryType: string
  correlationId: string
  timestamp: string
  actor:
    actorId: string
    roles: [string]
  organization:
    organizationId: string
    siteId: string | null
  filters: object
  pagination:
    page: integer
    pageSize: integer
  sorting:
    field: string
    direction: asc | desc
```

## Query Requirements
1. Inputs
- Aggregate identifiers or search filter criteria.

2. Filters
- Organization, site, status, date, actor, customer, reference domains as applicable.

3. Pagination
- Deterministic page and pageSize behavior.

4. Sorting
- Stable ordering fields and direction semantics.

5. Authorization
- Enforced before data exposure.

6. Output schema
- Versioned response with data, page metadata, and trace metadata.

## Output Contract
```yaml
QueryResponse:
  queryId: string
  status: success | failure
  data: object | [object]
  pagination:
    page: integer
    pageSize: integer
    totalRecords: integer
  metadata:
    contractVersion: string
    generatedAt: string
  error: null | object
```
