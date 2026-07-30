# Genesis Work Order Repository Model

## Repository Responsibilities
- Create and store work-order aggregates
- Create work orders from sales-order lineage
- Update draft attributes under validation and scope
- Manage revision records
- Enforce lifecycle transitions
- Capture audit records and publish domain events
- Provide list, search, timeline, revision, and audit query surfaces

## Storage Model
- In-memory maps for active state
- Persistent namespace: work-order-repository
- Per-organization sequence generator for business numbering
- Index from source sales-order id to work-order id for uniqueness control

## Concurrency and Safety
- Expected revision checks during persistence writes
- Mutation with rollback when persistence errors occur
- Conflict normalization for caller-friendly response shaping

## Determinism
- Transition and validation paths return structured issue lists
- Event publication uses stable envelope fields and contract version
