# 16 Test Report

Focused Slice 6 tests:
- tests/inventory/gidt-1001-s6-lot-serial-expiration.test.ts

Result:
- Test Suites: 1 passed
- Tests: 8 passed
- Snapshots: 0

Coverage highlights:
- lot registration and duplicate-code rejection.
- serial registration and duplicate-code rejection.
- one-active-location enforcement through movement-reference requirement.
- lot/serial association validation.
- quarantine/release/retirement transitions.
- expiration ordering and deterministic state evaluation.
- expired release restrictions.
- idempotency replay/conflict handling.
- runtime registration assertions.
