# GMDT-1001-S5

Manufacturing Platform Slice 5 implementation package.

Scope:
- Product/BOM baseline validation and freeze integration against bounded Product canonical authority.
- Deterministic material requirement derivation from BOM lines bound to frozen baseline and routing steps.
- Material-readiness projection and read-only material query surface.
- Runtime registration, failure classification, idempotency replay, and test evidence.

Out of scope:
- Material reservation/allocation execution and inventory movement orchestration.
- Production output completion, full WIP engine, resource execution, downtime.
- Persistence, HTTP transport APIs, and Mission Control policy semantics.
