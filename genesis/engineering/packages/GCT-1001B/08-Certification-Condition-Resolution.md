# 08 Certification Condition Resolution

Condition closure status:

- C1: CLOSED
- C2: CLOSED

C1 resolution mapping:

- Restart-safe: implemented via durable mergeIdempotencyRecords state.
- Deterministic lookup: implemented via scoped key lookup (tenant/source/target).
- Configurable TTL: runtime option mergeIdempotencyTtlMs.
- Cleanup policy: startup prune plus explicit cleanup method.
- Recovery validation: integrity validation during coordinator load.
- Duplicate merge rejection after restart: implemented and tested.
- Audit visibility: MERGE_IDEMPOTENCY_REJECTED event.
- Metrics: merge idempotency counts, rejections, and cleanup counters.

C2 resolution mapping:

- Deny-by-default: resolver decision path and 403 on denied decisions.
- Action-based authorization: explicit contact:health:view and contact:metrics:view actions.
- Authorization audit: resolver-backed authorization service audit path invoked per decision.
- Authorization metrics: deniedCount surfaced in denied route response.
- Preserve observability-only behavior: routes only expose observability payloads.
- No ownership changes: Contact remains consumer of authz framework.
