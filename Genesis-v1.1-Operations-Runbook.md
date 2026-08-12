# Genesis v1.1 Operations Runbook

Generated: 2026-08-11

## Purpose

This runbook covers controlled production publishing for Genesis Platform v1.1.

It is an operational certification guide, not a feature plan.

## Current Operational State

- Software readiness: PASS
- Bucket A: reconciled
- Bucket F: excluded from production readiness by operational policy
- Rollout status: controlled validation only

## Before Publishing

1. Verify queue health for the production-visible workload.
2. Verify worker registration and heartbeat status.
3. Verify callback contract behavior.
4. Verify planner output for the next publishing phase.
5. Verify WordPress authentication and connectivity.
6. Verify n8n telemetry for current and historical executions.
7. Confirm Bucket F is still excluded from production metrics.

## During Publishing

1. Start with the current rollout phase only.
2. Watch queue latency, callback success, and QA outcome.
3. Confirm duplicate protection remains active.
4. Confirm recovery actions are not triggered unexpectedly.
5. Log any deviation immediately.

## After Publishing

1. Record publish success %.
2. Record callback success %.
3. Record duplicate rate.
4. Record queue latency.
5. Record QA pass %.
6. Record worker uptime.
7. Record telemetry availability.

## Metrics Definitions

- Publish success %: successful publishes divided by attempted publishes.
- Callback success %: persisted callbacks divided by callback attempts.
- Duplicate rate: blocked duplicate attempts divided by total attempts.
- Queue latency: time from enqueue to dispatch and completion.
- QA pass %: QA passes divided by QA evaluations.
- Worker uptime: healthy worker time divided by scheduled worker time.
- Telemetry availability: readable execution details divided by requested execution details.
- Queue health score: operational score for the production-visible workload.

## Escalation Triggers

- No healthy workers.
- Queue backlog grows unexpectedly.
- Callback persistence fails or becomes inconsistent.
- Planner output diverges from the approved rollout phase.
- WordPress publish failures exceed the expected rate.
- n8n telemetry cannot read historical executions.

## Recovery Rules

- Use recovery only for explicitly approved safe recoveries.
- Do not mutate Bucket F.
- Do not delete historical testing artifacts.
- Do not advance rollout phases while a stop condition is active.

## Release Decision

Genesis Platform v1.1 is operationally certified for single-page production validation with staged rollout controls.