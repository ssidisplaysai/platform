# 02 Product Baseline Validation and Freeze

Implemented service:
- ManufacturingProductReferenceService

Behavior:
- Validates Product, Variant, Product Version, and BOM references through Product integration port.
- Enforces tenant consistency and expected-version concurrency checks.
- Records baseline state progression from DRAFT to VALIDATED to FROZEN on work order execution state.
- Prevents baseline drift by rejecting invalid canonical references before freeze.
- Emits audit records for validation and freeze actions.

Determinism and replay:
- Supports idempotent replay via idempotency key and payload fingerprinting.
- Rejects conflicting payloads for the same idempotency key.
