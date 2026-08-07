# 10 Idempotency Recovery

Idempotency state is persisted and restored with the tenant partition.

After restart, repeated commands with the same idempotency key replay deterministically, and conflicting payloads continue to reject.