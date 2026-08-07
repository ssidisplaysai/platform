# 16 Risk and Guardrails

Known risks:
- Domain primitives alone do not enforce transactional atomicity at infrastructure boundaries.
- Integration-time mapping can still mis-bind external references.

Guardrails introduced:
- Tenant boundary assertions.
- Deterministic ordering and lifecycle checks.
- Idempotency conflict classification primitives.
