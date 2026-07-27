# GOP-0006 Genesis Runtime Fabric

## Objective

Transform Genesis orchestration from single-process queue assumptions into a distributed execution fabric with deterministic dispatch, lease-based execution safety, worker trust, and durable operational control.

This milestone is additive and preserves GOP-0004A constitutional invariants.

## Runtime Topology

- Runtime remains orchestrator-centered.
- Queue manager now supports distributed semantics:
  - lease acquisition
  - lease renewal
  - lease release
  - lease expiration and safe reassignment
  - retry queue and dead-letter queue
- Worker registry now tracks protocol identity and health across restarts.
- Operations snapshot now includes fabric health, leases, dead letters, and utilization metrics.

## Lease Protocol

### Lease payload

- leaseId
- executionId
- queueItemId
- workerId
- leaseStartAt
- leaseExpiresAt
- heartbeatDeadlineAt
- renewalCount
- leaseState (`ACTIVE`, `RELEASED`, `EXPIRED`, `STOLEN`)
- protocolVersion
- tokenId

### Lifecycle

1. Worker acquires lease from queue for an eligible execution.
2. Worker renews lease with heartbeats.
3. Worker releases lease with deterministic outcome (`COMPLETED`, `FAILED`, `RETRY`, `ABANDONED`).
4. Expired leases are re-queued or dead-lettered based on retry policy.
5. Expired leases can be stolen safely by another worker.

### Safety guarantee

A queue item is removed from active queue at lease acquisition and tracked as active lease. Only one active lease exists per execution at a time.

## Distributed Queue Model

### Dispatch constraints

- priority ordering with aging boost (starvation prevention)
- scheduled execution gating
- worker type matching
- capability matching
- worker affinity support
- workspace/module scoping
- capacity-aware acquisition

### Queue controls

- pause/resume/drain
- retry queue
- dead-letter queue
- metrics:
  - queued
  - leased
  - retry queued
  - dead-lettered
  - expired lease count
  - p50/p95 dispatch and queue wait latency
  - lease utilization

## Worker Protocol

### Protocol endpoints

- `POST /api/gop/workers/protocol/register`
- `POST /api/gop/workers/protocol/:id/heartbeat`
- `POST /api/gop/workers/protocol/:id/leases/acquire`
- `POST /api/gop/workers/protocol/:id/leases/renew`
- `POST /api/gop/workers/protocol/:id/leases/release`

### Worker actions

- register with capabilities and capacity
- authenticate using signed bearer token
- heartbeat and protocol negotiation
- acquire/renew/release leases

### Recovery behavior

- stale workers are marked offline
- expired leases return to retry queue
- retries promote to dead-letter on policy exhaustion

## Worker Trust Model

- Signed token verification via HMAC worker token.
- Token binds:
  - workerId
  - tokenId
  - protocolVersion
  - issuedAt/expiresAt
- No anonymous protocol workers.
- Design remains compatible with future mTLS by preserving `authMode` and protocol metadata in worker registration.

## Dead-letter Lifecycle

### Stored fields

- execution id and queue item id
- workspace and module
- queue name
- reason
- retry/failure history
- operator notes
- archived/recovered markers

### Controls

- inspect dead letters in operations snapshot
- retry dead-letter execution
- archive dead-letter execution

## Dispatch Determinism

Dispatch sort key:

1. Effective priority weight
2. Aging boost
3. Enqueued timestamp
4. Worker ID tie-break at worker selection

This ensures stable ordering under concurrent workers and repeatable scheduling behavior.

## Observability

Operations snapshot now includes:

- active leases
- dead-letter entries
- queue retry/dead-letter/leased depths
- worker utilization
- fabric metrics:
  - dispatch p50/p95
  - lease acquisition p50/p95
  - queue wait p50/p95
  - worker idle p95
  - retry and dead-letter rates per minute
  - throughput per minute

## Performance Notes

- in-memory deterministic indexes for active queue, leased map, dead-letter map
- bounded percentile calculations over sampled latencies
- capacity-aware dispatch loop
- reduced contention by keeping lease operations local to queue manager abstraction

## Validation Checklist

- GLW page generation path preserved.
- Existing session auth endpoints preserved.
- Existing operations endpoint shape preserved and expanded additively.
- Lease expiration and dead-letter behaviors covered in GOP fabric tests.
- No destructive schema changes.

## Schema Evolution

Added additive Prisma models:

- `GopWorker`
- `GopExecutionLease`
- `GopDeadLetter`

Migration:

- `prisma/migrations/20260726103000_gop_runtime_fabric/migration.sql`

## Future GOP-0007 Recommendation

- Persist live queue state (not only execution and snapshots) as authoritative distributed scheduler state.
- Add lease fencing tokens for stronger cross-host conflict prevention.
- Introduce worker pull long-poll or stream protocol to reduce heartbeat traffic.
- Add placement and locality-aware dispatch policy plugins.
- Add chaos-suite with induced DB/network partitions across multiple runtime hosts.
