# 07 Expiration Service

ExpirationService responsibilities implemented:
- Deterministic state evaluation using runtime clock provider.
- Date-ordering validation and rejection for invalid orderings.
- State transitions to NEAR_EXPIRY or EXPIRED based on evaluated time and metadata.
- Expiration status retrieval and deterministic listing helpers.
- Quarantine semantics through state outcome and identity updates where applicable.
- Audit evidence and idempotency.

Expiration evaluation does not mutate physical stock quantities.
