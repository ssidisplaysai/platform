# 03 Lot Service

LotService responsibilities implemented:
- Register lot with tenant and inventory item validation.
- Enforce lot-code uniqueness within tenant and item scope.
- Enforce expected-version checks on mutation.
- Update approved lot metadata and expiration dates with ordering validation.
- Quarantine lot.
- Release lot from quarantine when expiration policy permits.
- Retire lot.
- Deterministic get/list behavior.
- Audit evidence for accepted/rejected transitions.
- Tenant-scoped idempotency for register and transition commands.

No physical movement or receiving implementation was added.
