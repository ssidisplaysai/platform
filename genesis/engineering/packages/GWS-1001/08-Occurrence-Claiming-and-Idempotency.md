# 08 Occurrence Claiming and Idempotency

## Claim Model

1. Unique occurrence identity: instanceId + dueAt.
2. Claim records include idempotency key and expiration timestamp.
3. Claim states: CLAIMED, COMPLETED, FAILED, EXPIRED.

## Idempotency and Conflict Behavior

1. Existing claimed occurrence with same idempotency key is treated as already claimed.
2. Existing claimed occurrence with different idempotency key is treated as conflict.
3. Duplicate trigger dispatch is blocked via claim-check flow before dispatch.

## Stale Claim Recovery

1. Expired CLAIMED entries are marked EXPIRED on recovery/evaluation.
2. Expired claims can be safely reclaimed.

## Guarantee Scope

Current guarantees are single-writer durable abstraction guarantees, documented as:
- CLAIM_STORE_ABSTRACTION_SINGLE_WRITER
