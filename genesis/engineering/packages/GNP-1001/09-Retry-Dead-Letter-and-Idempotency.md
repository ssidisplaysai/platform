# 09 Retry, Dead Letter, and Idempotency

Retry strategy:
1. Retry decisions use the notification definition retry policy.
2. Retryable failures respect max attempts and backoff delay.
3. Retry scheduling is emitted as audit evidence.

Dead-letter strategy:
1. Non-retryable or exhausted failures are moved to a durable dead-letter record.
2. Dead-letter records preserve request identity, reason, and final attempt number.

Idempotency strategy:
1. Notification requests are deduplicated by idempotency key.
2. Duplicate processing requests short-circuit rather than re-delivering side effects.
