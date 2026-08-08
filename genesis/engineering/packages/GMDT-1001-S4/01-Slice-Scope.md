# 01 Slice Scope

Slice 4 delivers Manufacturing-owned execution routing and operation-execution behavior on top of S1-S3.

Included:
- Routing creation, graph integrity validation, deterministic sequencing, and bounded rework-edge representation.
- Operation lifecycle and prerequisite enforcement with tenant isolation, idempotency, and optimistic concurrency.
- Deterministic read-only routing/operation query surface.

Explicitly excluded:
- Product/Inventory live execution behavior and material/output processing.
- Persistence, external validators beyond registration contracts, and APIs.
