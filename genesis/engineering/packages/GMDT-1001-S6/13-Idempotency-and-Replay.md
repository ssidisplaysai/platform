# 13 Idempotency and Replay

Issue and consumption orchestration use payload fingerprint replay semantics:
- same key + same payload => deterministic replay
- same key + different payload => deterministic conflict rejection
