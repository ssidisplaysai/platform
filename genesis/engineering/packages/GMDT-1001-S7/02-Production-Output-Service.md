# 02 Production Output Service

Service: manufacturing.service.production-output

Behavior:
- Validates work-order state, product baseline freeze, product-version consistency, units, and expected versions.
- Supports dispositions GOOD, REJECTED, SCRAP, REWORK, INTERMEDIATE, FINISHED.
- Applies bounded quantity deltas to work-order and operation execution state.
- Uses tenant-scoped idempotency and deterministic payload fingerprinting.