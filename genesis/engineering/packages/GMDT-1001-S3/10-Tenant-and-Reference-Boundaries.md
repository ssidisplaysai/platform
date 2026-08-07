# 10 Tenant and Reference Boundaries

Tenant isolation is enforced across all Slice 3 services.

Validation boundaries include:
- Product/product-variant/product-version/BOM tenant consistency.
- Work-order tenant ownership for runs and batches.
- Run-to-work-order relationship consistency for batch creation.

Invalid boundaries are rejected through explicit domain classifications.
