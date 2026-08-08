# 12 Concurrency and Idempotency

Optimistic concurrency and idempotency controls implemented for routing and operation commands.

Concurrency:
- expected-version checks reject stale writes.
- deterministic single-step version increments.

Idempotency:
- tenant-scoped command-family keys.
- same key + same payload => replay.
- same key + different payload => conflict rejection.
- replay does not duplicate transitions.
