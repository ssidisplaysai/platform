# 11 Idempotency and Version Recovery

Recovered state includes:
- idempotency maps for implemented command families
- entity versions embedded in canonical records
- operation initialization replay state

Post-restart guarantees validated:
- accepted work-order create replay remains accepted
- conflicting idempotency payload remains rejected
- stale expected version remains rejected
- no version reset to zero
