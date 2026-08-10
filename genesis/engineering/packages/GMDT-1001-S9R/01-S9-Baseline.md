# 01 S9 Baseline

Baseline under review:
- Commit: 60e1372
- Message: feat(manufacturing): implement reference validation and observability

Observed baseline behavior in ManufacturingReferenceValidationService:
- Product/Inventory validator families register via explicit built-ins.
- External validators iterated over a fixed external family list.
- Prior logic used first-wins guard (if validators.has(family) continue), silently ignoring later same-family registrations.

Conformance gap:
- first-wins silent ignore did not satisfy deterministic duplicate authoritative-registration rejection.
