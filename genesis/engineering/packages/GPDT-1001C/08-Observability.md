# 08 Observability

Observability model:

1. Audit model
- Capture Product-domain mutation traces with actor, timestamp, tenant, command id, and outcome.
- Capture lifecycle/version transitions as auditable records.

2. Metrics model
- Product counts by lifecycle state.
- Variant counts by Product.
- Configuration validity and rule-cycle rejection counts.
- BOM validation rejection counts.
- Pricing-definition version counts.
- Reference validation failure counts.

3. Health model
- Persistence health.
- Integration dependency health.
- Invariant enforcement health.
- Runtime composition health.

Mission Control observability constraints:

1. Observational only.
2. No business mutation authority.
3. Authorization-gated access required.

AI observability constraints:

1. Advisory-only insight consumption.
2. No AI mutation authority on Product canonical state.
3. Recommendation provenance must be auditable.

Telemetry contract requirements:

1. Stable projection schemas.
2. Versioned observability payloads.
3. Tenant-safe and privacy-safe metadata handling.
