# Genesis v1.1 Production Rollout Checklist

Generated: 2026-08-11

## Rollout Policy

Use staged production publishing only. Advance one phase at a time. Do not skip validation.

Bucket F is excluded from production readiness by operational policy and must remain excluded from production metrics.

## Pre-Publishing Checks

- Queue is healthy for the production-visible workload.
- Bucket A is reconciled.
- Bucket F remains classified as manual historical testing artifacts.
- Workers are registered and reporting healthy heartbeats.
- Callback persistence is confirmed.
- Planner output matches the intended phase.
- WordPress connectivity is verified.
- n8n telemetry can read current and historical executions.

## Rollout Phases

### Phase 1

- Publish one production page.
- Confirm callback persistence, duplicate protection, queue transition, and WordPress result.

### Phase 2

- Expand to 8 pages under controlled validation.
- Review each callback, QA result, and queue transition.

### Phase 3

- Increase to 25 pages/day.
- Observe for 48 to 72 hours.
- Track duplicate rate, callback success, queue latency, and worker uptime.

### Phase 4

- Increase to 50 pages/day only if Phase 3 remains stable.

### Phase 5

- Enable SSI only after the rollout is stable and the production metrics remain within target ranges.

## Stop Conditions

- Queue health degrades for the production-visible workload.
- Workers fall to zero or become unstable.
- Callback persistence fails.
- Planner output changes unexpectedly.
- WordPress publishing errors increase materially.
- n8n telemetry becomes unavailable for current or historical executions.

## Operator Record

- Record phase start time.
- Record page count.
- Record queue health score.
- Record callback success %.
- Record duplicate rate.
- Record QA pass %.
- Record worker uptime.
- Record telemetry availability.

## Exit Criteria

- Phase 1 exits only after a successful single-page publish.
- Phase 2 exits only after the 8-page cohort completes without systemic failures.
- Phase 3 exits only after the 48 to 72 hour observation window is stable.
- Phase 4 exits only after 50 pages/day remains stable.
- Phase 5 exits only after SSI has been enabled and observed successfully.