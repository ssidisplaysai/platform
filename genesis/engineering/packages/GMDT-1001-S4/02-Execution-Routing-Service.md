# 02 Execution Routing Service

ExecutionRoutingService implemented under Manufacturing ownership.

Delivered behavior:
- CreateExecutionRouting command processing with tenant/work-order checks.
- Routing identity uniqueness and per-work-order routing uniqueness.
- Routing-step/operation identity integrity validation.
- Expected-version and idempotency enforcement.
- Deterministic get/list retrieval and routing readiness projection.
- Audit emission for accepted/rejected/replayed commands.
