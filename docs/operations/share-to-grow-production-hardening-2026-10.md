# Share-to-Grow Production Hardening — 2026-10

## Production RDS Multi-AZ Scheduling Evidence

- Timestamp (local): `2026-10-11T18:50:53.6900748-07:00`
- Applying role ARN: `arn:aws:sts::452630323448:assumed-role/GenesisProductionRdsChangeRole/ScheduleMultiAzDeferred`
- Caller identity ARN: `arn:aws:sts::452630323448:assumed-role/GenesisProductionRdsChangeRole/ScheduleMultiAzDeferred`

### Target DB

- DB identifier: `genesis-production-postgres`
- Pre-state MultiAZ: `false`
- Scheduled target state: `MultiAZ=true`
- applyImmediately: `false` (`--no-apply-immediately`)
- Maintenance window: `tue:12:15-tue:12:45`

### Accepted Pending Modification

- `PendingModifiedValues.MultiAZ=true`
- Current `MultiAZ=false` (expected until maintenance window apply)
- RDS status after scheduling: `available`

### Unchanged DB Properties After Scheduling

- Engine/version: `postgres 16.13`
- Instance class: `db.t4g.micro`
- Allocated storage: `20` GiB
- Storage type: `gp3`
- Subnet group: `genesisfoundationstack-genesispostgressubnetgroup91e30356-zpynhgzxmpua`
- VPC security groups: `sg-0ef556836f34707ee`
- Parameter group: `default.postgres16`
- Storage encryption: `enabled`
- Deletion protection: `enabled`
- Backup retention: `7` days
- Public accessibility: `false`

### Application/Alarm Postcheck After Scheduling

- ECS service: `genesis-production-web`
- Task definition: `genesis-production-web:86`
- desired/running/pending: `1/1/0`
- rollout state: `COMPLETED`
- Target health: `healthy`
- Alarms `genesis-prod-*`: `15 OK`, `0 ALARM`, `0 INSUFFICIENT_DATA`

### Notes

- A short-lived non-service ECS task (`genesis-private-migration-runtime:5`) was observed during this window with `MIGRATION_MODE=verify-only`; it exited and no non-service running tasks remained after scheduling.
- No secret values are recorded in this artifact.

## Production Foundation Schema/Grant Phase Attempt (Blocked)

- Timestamp (local): `2026-10-11T20:09:45-07:00`
- Target DB: `genesis-production-postgres` / `genesis`
- RDS status during gate: `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Alarms during gate: `15 OK`, `0 ALARM`

### Precheck Findings

- `public.genesis_foundation_state`: absent
- `public.genesis_schema_migrations`: absent
- Foundation row count: `0`
- Business namespace rows (`share-to-grow-repository`): `0`

### Migration Execution Attempt

- Mechanism: bounded one-off ECS task in private subnets (no public IP), task definition `genesis-private-migration-runtime:5`
- Attempted canonical command: `node scripts/migrate-foundation-state.mjs up`
- Result: failed (`MODULE_NOT_FOUND`) because `/workspace/scripts/migrate-foundation-state.mjs` is not present in the current production runtime image lineage.
- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/6b9ed4ad8a194104892a7d66d91beb07`

### Runtime Drift Noted During Phase

- Live production service was observed at `genesis-production-web:90` (not `:88`) while remaining healthy (`1/1/0`, `COMPLETED`, target healthy).
- No service update was performed by this phase.

### Phase Classification

- `PRODUCTION_FOUNDATION_SCHEMA_AND_GRANTS=BLOCKED_MIGRATION`
- Reason: canonical migration source/framework required for approved production foundation migrations is not present in the current production runtime image path used by existing bounded migration tasks.

## Production Foundation Schema/Grant Phase (Completed)

- Timestamp (local): `2026-10-11T20:27:34-07:00`
- Live service during phase: `genesis-production-web:90` (`1/1/0`, `COMPLETED`, target healthy)
- Alarms during phase: `15 OK`, `0 ALARM`
- RDS during phase: `available`, `MultiAZ=true`, `PendingModifiedValues={}`, deletion protection enabled, backups active

### Runtime Provenance Reconciliation

- Revision transitions observed:
  - `:88 -> :89`: image digest and `GIT_COMMIT` changed only
  - `:89 -> :90`: image digest and `GIT_COMMIT` changed only
- No material runtime config drift across `:88/:89/:90` for backend, DB bindings, secret bindings, CA path, roles, cpu/memory, command/entrypoint, volumes/mounts, logging, or health config.
- CloudTrail actors for both `RegisterTaskDefinition` and `UpdateService` events were CLI invocations by:
  - `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`

### Dedicated Production Migration Path

- Runner script: `scripts/migrate-foundation-state-production.mjs`
- Dedicated image tag: `foundation-migration-20261011-2027`
- Dedicated image digest: `sha256:14b21cda4e1d9d303ffa50ac66ccba6f763670af9946e184b84831e985c980bb`
- Image entrypoint: `node scripts/migrate-foundation-state-production.mjs`
- Approved migration allowlist:
  - `20261009000000_foundation_state.js`
  - `20261010204600_add_foundation_state_constraints.js`
- CA bundle checksum in image:
  - `fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c`

### Migration Execution

- Task definition: `genesis-production-foundation-migration:1`
- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/967a21dad7bc429eb2b908f4a024c1c7`
- Result: exit code `0`
- Applied migrations:
  - `20261009000000_foundation_state`
  - `20261010204600_add_foundation_state_constraints`
- No Share-to-Grow import/seed executed.

### Post-Migration Schema Verification

- Table: `public.genesis_foundation_state`
- Owner: `genesis_admin` (application role is not owner)
- Columns:
  - `namespace text not null primary key`
  - `schema_version integer not null`
  - `revision bigint not null default 0`
  - `updated_at timestamptz not null`
  - `data jsonb not null`
- Constraints:
  - `genesis_foundation_state_pkey`
  - `genesis_foundation_state_revision_nonnegative`
  - `genesis_foundation_state_data_object`
- Migration records:
  - `20261009000000_foundation_state:1`
  - `20261010204600_add_foundation_state_constraints:1`
- Business rows: `0`
- Namespaces: none

### Genesis App Grants and Certification

- Granted to `genesis_app`:
  - `USAGE` on schema `public`
  - `SELECT`, `INSERT`, `UPDATE` on `public.genesis_foundation_state`
- Explicitly not granted:
  - `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, schema `CREATE`
- Rolled-back functional certification executed with namespace:
  - `production-app-principal-certification-e33f780cc89c4543a857c3104f3d6b4d`
- Transaction sequence: `BEGIN -> SELECT -> INSERT -> UPDATE(revision predicate) -> SELECT verify -> ROLLBACK`
- Post-rollback verification:
  - certification rows remaining: `0`
  - total foundation rows: `0`

### Live Runtime Safety

- No production web task-definition registration performed.
- No `UpdateService` call performed.
- Runtime credentials remain unchanged (not rebound to app secret yet).
- No production business data created or imported.

## Production Runtime DB Credential Rebind (Completed)

- Change window start (UTC): `2026-10-12T03:55:20Z`
- Service: `genesis-production-web`
- Cluster: `genesis-production`
- Baseline revision before change: `genesis-production-web:90`
- Deployed revision after change: `genesis-production-web:91`

### Scope and Guardrails

- Exactly one production service update was executed.
- No image change, code change, role change, cpu/memory change, network mode change, or command/entrypoint change was introduced.
- Only DB credential secret bindings were changed (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`) from admin secret to app secret.

### Execution Role Secret Scope Tightening

- Execution role: `GenesisRuntimeStack-RuntimeTaskExecutionRole9B42490-R0neRrBR8s7H`
- Inline policy updated to allow:
  - `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/postgres-app-Hpm0Rc`
- Admin DB secret access was removed from this execution role.
- IAM simulation results:
  - app secret read: `allowed`
  - production admin secret read: `implicitDeny`
  - staging app secret read: `implicitDeny`

### Pre-Deploy Gate (Immediately Before UpdateService)

- RDS: `available`
- RDS MultiAZ: `true`
- RDS pending modifications: `{}`
- Pending maintenance actions: `0`
- ECS service: `1/1/0`, rollout `COMPLETED`, deployment count `1`
- Target health: `healthy` (single target)
- Alarms `genesis-prod-*`: `15 OK`, `0 ALARM`, `0 INSUFFICIENT_DATA`
- No running schema/import jobs in production cluster.

### Authorized Mutation

- Task definition registered: `genesis-production-web:91`
- Exact material diff from `:90` to `:91`:
  - `DB_HOST` secret ARN changed to app secret path
  - `DB_PORT` secret ARN changed to app secret path
  - `DB_NAME` secret ARN changed to app secret path
  - `DB_USERNAME` secret ARN changed to app secret path
  - `DB_PASSWORD` secret ARN changed to app secret path
- Single service update executed:
  - `aws ecs update-service --cluster genesis-production --service genesis-production-web --task-definition genesis-production-web:91`

### Convergence Evidence

- New task started: `154f4c8b5e8745b0bbe116299804be7c`
- Prior task stopped: `7c6cdbc758c04486bf90589dca0e2a81`
- Drain/replace completed successfully.
- Time to stable: `185` seconds
- Final state: `1/1/0`, rollout `COMPLETED`, target `healthy`

### Runtime Principal and Privilege Proof

- One-off app-secret probe (bounded ECS task) returned:
  - `current_user=genesis_app`
  - `current_database=genesis`
- Rolled-back functional transaction as `genesis_app`:
  - `BEGIN -> INSERT -> UPDATE -> SELECT verify -> ROLLBACK`
  - post-rollback verification rows: `0`
- No residual rows remained in `public.genesis_foundation_state`.

### Post-Change Safety Checks

- RDS remained: `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Alarms remained: `15 OK`, `0 ALARM`, `0 INSUFFICIENT_DATA`
- No ECS restart loops, no additional deployments, and no schema/import execution occurred.
- No production business data imports/seeds were executed.
