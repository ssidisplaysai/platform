# 06 Failure Model and Idempotency

Failure model coverage:
- PRODUCT_BOM_INVALID for bounded Product authority rejection.
- CONFLICTING_IDEMPOTENCY_PAYLOAD for payload mismatch on replay key reuse.
- Concurrency rejection when expected version is stale.
- Tenant boundary rejection for cross-tenant references.

Idempotency behavior:
- Validation, freeze, and material derivation support replay semantics.
- Replayed payloads return equivalent results.
- Conflicting replay payloads are rejected deterministically.
