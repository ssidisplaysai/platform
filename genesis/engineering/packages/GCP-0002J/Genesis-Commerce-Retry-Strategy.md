# Genesis Commerce Retry Strategy

## Retry Semantics
1. Transient failures: retry.
2. Permanent failures: dead-letter.
3. Consumer decides replay policy from dead-letter queue.

## Retry Contract Fields
```yaml
RetryMetadata:
  retryable: boolean
  retryCategory: transient | permanent
  retryAttempt: integer
  maxRetryAttempts: integer
  nextRetryAt: string | null
  deadLettered: boolean
```

## Recommended Retry Behavior
1. Exponential backoff with jitter for transient transport or dependency errors.
2. Bounded attempt count to avoid infinite loops.
3. Escalation to dead-letter when retry budget exhausted.
4. Replay only with preserved correlation, causation, and idempotency metadata.

## Governance Constraints
1. Retry behavior must not violate event immutability.
2. Retry must not generate new business facts for duplicate payload.
3. Replay operations must be auditable and deterministic.
