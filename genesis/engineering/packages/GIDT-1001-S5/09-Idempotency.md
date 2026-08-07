# 09 Idempotency

Tenant-scoped idempotency is implemented for:
- Reservation create/release/expiry.
- Allocation create/release.
- Reservation-to-allocation conversion.

Rules enforced:
- Same key + same payload replays prior outcome.
- Same key + conflicting payload rejects with CONFLICTING_IDEMPOTENCY_PAYLOAD.
- Replay never doubles commitment mutation.
- Replay events are auditable.
