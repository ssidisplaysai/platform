# Genesis Commerce Idempotency Model

## Idempotency Requirements
1. Every event exposes deterministic idempotencyKey.
2. Every command envelope contains idempotencyKey.
3. Consumers safely handle duplicate deliveries.
4. Replay preserves original idempotency semantics.

## Idempotency Key Contract
```yaml
Idempotency:
  key: string
  scope:
    producer: string
    aggregateType: string
    aggregateId: string
  source:
    eventId: string | null
    commandId: string | null
```

## Consumer Processing Rules
1. Check idempotency store before applying side effects.
2. If key exists and payload hash matches, acknowledge without duplicate mutation.
3. If key exists and payload hash differs, route to conflict handling.
4. Persist processing result with correlation metadata.

## Producer Processing Rules
1. Generate deterministic keys for repeatable publication behavior.
2. Never reuse key for semantically different payload.
3. Preserve idempotency key across retries and republish attempts.

## Deterministic Replay Support
1. Replay emits original envelope identity and idempotency key.
2. Consumers can re-evaluate idempotency without custom exceptions.
