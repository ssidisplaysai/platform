# 08 Idempotency

Implemented behavior:

1. idempotency key is tenant scoped
2. same key with same command payload returns original accepted result
3. same key with conflicting payload rejects deterministically
4. duplicate movement does not apply twice
5. duplicate adjustment does not apply twice
6. idempotency replay and conflict outcomes are auditable
7. no silent overwrite exists

Durability limitation:

1. durable idempotency persistence is deferred
2. domain behavior is implementation-ready in memory