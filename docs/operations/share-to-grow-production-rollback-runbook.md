# Share-to-Grow Production Rollback Runbook

## Scope

This runbook defines **application rollback only** for production service `genesis-production-web` in cluster `genesis-production`.

- Current production backend is PostgreSQL (`GENESIS_STATE_BACKEND=postgres`).
- There is no filesystem/EFS fallback in the current production lineage.
- Rollback must preserve the current production PostgreSQL state.

## Current Provenance Snapshot

- Service: `genesis-production-web`
- Cluster: `genesis-production`
- Current known-good task definition: `genesis-production-web:88`
- Current known-good image digest: `sha256:236e797105c4d9f1f19a1b804449c964a041972ebc72b4973652efbff3ef5c69`
- Nearest prior rollback candidate task definition: `genesis-production-web:87`
- Nearest prior rollback candidate image digest: `sha256:6858d062ecb3235240b6d03653f2f94e608ac91cd6edb30cab8a266d98c601ea`

## Critical Rollback Rule (PostgreSQL Preservation)

Rollback in this environment means:

1. move application runtime from a newer task definition
2. to a known-good prior task definition
3. while preserving the same production PostgreSQL state

Never perform the following as part of application rollback:

- import older state
- restore old foundation JSON
- revert production DB revision/state
- copy staging state to production
- switch production persistence backend to filesystem

## Rollback Triggers

Application rollback triggers include:

- essential container crash/restart loop
- deployment failure with ECS circuit breaker rollback pressure
- sustained target unhealthy state
- persistent application 5xx
- PostgreSQL connection/auth/TLS runtime failure in application path
- persistence adapter failure signals
- Share-to-Grow write-path corruption indicators
- Share-to-Grow webhook processing failure rate above approved threshold

## Application Rollback vs Database Recovery

- **Application rollback**: ECS service task definition change only.
- **Database recovery**: separate procedure and separate explicit authorization.

Database recovery is not implied by application rollback and must never be executed implicitly.

## Pre-Rollback Capture Requirements

Before any rollback execution, capture and record:

1. current ECS deployment ID
2. current task definition revision
3. current image digest
4. current production business revision/hash (if available through approved probe path)
5. explicit PostgreSQL-preservation acknowledgment
6. rollback reason and trigger evidence

## Post-Write Compatibility Guard

Once production has accepted Share-to-Grow writes on PostgreSQL:

- do not roll back to an application revision that is incompatible with current persisted schema/state.

Before rollback, verify:

1. schema compatibility
2. state compatibility
3. runtime compatibility
4. webhook compatibility

If compatibility is unknown, rollback is blocked pending explicit review.

## Bounded Rollback Command Pattern (Do Not Execute Without Authorization)

```bash
aws ecs update-service \
  --cluster genesis-production \
  --service genesis-production-web \
  --task-definition <known-good-revision>
```

## Post-Rollback Verification Requirements

After rollback execution completes:

1. wait for healthy ECS convergence
2. verify target health in ALB
3. verify runtime backend selection remains PostgreSQL
4. verify production business state is unchanged
5. confirm no unauthorized DB recovery actions occurred
6. record final evidence artifact for audit
