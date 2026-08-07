# 03 Reservation Service

Implemented ReservationService responsibilities:
- Create reservation with balance/item/scope validation.
- Enforce expected balance version and tenant isolation.
- Support partial reservation only when explicitly allowed.
- Release reservation (full or partial).
- Expire reservation and release remaining commitment.
- Deterministic listing and retrieval.
- Audit accept/reject/replay outcomes.
- No physical movement execution.

State mutation is atomic in-memory: both reservation and balance commitment update together or reject.
