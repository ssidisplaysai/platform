# 02 Work Order Foundation

Implemented ManufacturingWorkOrderService with deterministic in-memory records.

Key capabilities:
- Create work orders with strict tenant/reference validation.
- Enforce unique work-order identity and number boundaries per tenant.
- Lifecycle mutation commands with expected-version concurrency checks.
- Idempotent replay support with payload fingerprint conflict protection.
- Audit emission on accepted and rejected transitions.
