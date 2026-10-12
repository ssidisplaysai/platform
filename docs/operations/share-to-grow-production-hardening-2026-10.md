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

## Production Post-Rebind Remediation (Completed)

- Remediation window: `2026-10-12T13:18:11Z` to `2026-10-12T13:35:10Z` (17m)
- Live runtime remained `genesis-production-web:91` (`1/1/0`, `COMPLETED`, target healthy) throughout.

### Root Cause: `operator_state_pages` Permission Error

- Error observed: `permission denied for table operator_state_pages` (`aclcheck_error`, SQLSTATE `42501`)
- Runtime stack evidence: repository `read()` path in SSR chunk, then `getDashboard`.
- Source in live image confirms PostgreSQL operator-state repository access:
  - `apps/web/src/lib/page-factory-client/persistence/operator-state-postgres-repository.ts`
  - `apps/web/src/lib/page-factory-client/persistence/media-registry-postgres-repository.ts`
  - Wiring via `apps/web/src/lib/page-factory-client/persistence/repositories.ts` with `GENESIS_STATE_BACKEND=postgres`
  - Dashboard route calls `client.getDashboard()` from `apps/web/src/app/dashboard/page.tsx`

### Proven Runtime Table Access Surface

- Runtime tables used by web image (`:91`) postgres repositories:
  - `public.operator_state_pages` (`SELECT`, `INSERT`, `DELETE`)
  - `public.operator_state_jobs` (`SELECT`, `INSERT`, `DELETE`)
  - `public.operator_state_approvals` (`SELECT`, `INSERT`, `DELETE`)
  - `public.media_registry_assets` (`SELECT`, `INSERT`, `UPDATE` via upsert, `DELETE`)
- `public.genesis_foundation_state` is present and still granted as before (`SELECT/INSERT/UPDATE`), but no direct reference was found in live web-image source search for `genesis_foundation_state`.
- Migration/admin table `public.genesis_schema_migrations` remains admin-owned and was not granted to app runtime.

### DB Privilege Remediation Applied

Grants added to `genesis_app` (no ownership or schema changes):

- `GRANT SELECT,INSERT,DELETE ON public.operator_state_pages TO genesis_app`
- `GRANT SELECT,INSERT,DELETE ON public.operator_state_jobs TO genesis_app`
- `GRANT SELECT,INSERT,DELETE ON public.operator_state_approvals TO genesis_app`
- `GRANT SELECT,INSERT,UPDATE,DELETE ON public.media_registry_assets TO genesis_app`

Post-remediation non-mutating app-principal checks:

- `current_user=genesis_app`
- `has_table_privilege` passed for all required table privilege sets
- Foundation remains restricted: `DELETE` on `genesis_foundation_state` remains `false`

### IAM Remediation Applied

- Removed inline policy `MigrationSecretAccessPatch20261012` from:
  - `GenesisRuntimeStack-RuntimeTaskExecutionRole9B42490-R0neRrBR8s7H`
- Final inline policy set on execution role:
  - `RuntimeTaskExecutionRoleDefaultPolicy1AEEA0C1` only
- Simulation after removal:
  - app secret (`genesis/production/postgres-app-*`) `GetSecretValue`: `allowed`
  - production admin DB secret (`GenesisFoundationStackGenes-*`) `GetSecretValue`: `implicitDeny`
  - staging app DB secret: `implicitDeny`
- OpenAI/WordPress wildcard-style suffix patterns remained unchanged and do not match the admin DB secret ARN pattern.

### Persistence Alarm Name Reconciliation

The previous “missing persistence alarms” result was a naming mismatch. Actual alarms are:

- `genesis-prod-app-persistence-backend-unsupported`
- `genesis-prod-app-persistence-config-failed`
- `genesis-prod-app-persistence-connection-failed`
- `genesis-prod-app-persistence-read-failed`
- `genesis-prod-app-persistence-write-failed`
- `genesis-prod-app-persistence-schema-mismatch`
- `genesis-prod-app-persistence-revision-conflict`

All were `OK` during this remediation window.

### Post-Fix Monitoring Evidence

- Window: `2026-10-12T13:18:11Z` → `2026-10-12T13:35:10Z`
- ECS remained stable: `:91`, `1/1/0`, `COMPLETED`, target healthy (`10.42.2.206`)
- Alarms final: `15 OK`, `0 ALARM`, `0 INSUFFICIENT_DATA`
- No new alarm state transitions in window
- App log scan in window:
  - no DB permission errors
  - no DB authentication errors
  - no secret-access errors
  - no persistence failure markers
- ALB metrics:
  - no target/ELB 5xx datapoints
  - healthy host count remained `1`
  - unhealthy host count remained `0`
- RDS remained stable:
  - `available`, `MultiAZ=true`, `PendingModifiedValues={}`
  - backups retained `7`, latest restorable time continued advancing
- Foundation state remained unchanged:
  - row count `0`
  - namespaces none
  - migration records: both expected entries remained exactly once

### Safety Boundary Confirmation

- No `UpdateService` call
- No new web task-definition registration
- No DB schema changes
- No persistent production business-data writes/imports
- Woo production webhook configuration remains out of scope and unchanged

## Production Share-to-Grow Canonical Initialization (Completed)

- Execution window (UTC): `2026-10-12T14:39:59Z` → `2026-10-12T14:51:35Z`
- Canonical namespace: `share-to-grow-repository`
- Source-of-truth classification: `A` (approved empty canonical production state)

### Initialization Artifact (Deterministic)

- Artifact path: `artifacts/production/share-to-grow-initial-state.json`
- Envelope: `schemaVersion=1`, `revision=0` (pre-write artifact), canonical empty arrays for all required collections
- File byte length: `330`
- File SHA-256: `f566f6090b0b51ebd847d77ebaed134f5d9631c67bc5c42e9d5354f05c58d3a8`
- Canonical data SHA-256 (`stableJson(data)`): `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Determinism check: pass (repeat serialization/hash matched)
- Synthetic/staging identifier scan: pass

### Final Pre-Write Gate

- ECS: `genesis-production-web:91`, desired/running/pending `1/1/0`, rollout `COMPLETED`, deployments `1`
- Target health: single healthy target observed at gate time
- Alarms `genesis-prod-*`: `15 OK`, `0 ALARM`
- RDS: `available`, `MultiAZ=true`, `PendingModifiedValues={}`, pending maintenance `0`, deletion protection `true`
- App-principal DB checks:
  - `public.genesis_foundation_state` visible
  - `share-to-grow-repository` namespace absent before write

### Authorized Initialization Write (One Call)

- Mechanism: one-off ECS task (`genesis-production-db-app-probe:1`) using production **app** DB secret bindings
- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/149a77cf630c4c669bebccdbb2c1b5b3`
- Container exit code: `0`
- Write form: `INSERT ... ON CONFLICT(namespace) DO NOTHING` into `public.genesis_foundation_state`
- Materialized persisted state verified post-write as:
  - namespace row count `1`
  - `schema_version=1`
  - `revision=1`
  - all eight top-level Share-to-Grow collections present and empty

### Idempotency / Replay Verification

- Replay #1 task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/161ff5790b584c0f90546ce2b867b080` (exit `0`)
- Post-replay verification task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/92c76de186bf475ab5796337fb161c3f` (exit `0`)
- Controlled restart:
  - `UpdateService --force-new-deployment` once
  - task definition unchanged: `genesis-production-web:91`
  - task ARN rotated:
    - before: `.../154f4c8b5e8745b0bbe116299804be7c`
    - after: `.../b79fca6336a641d392e123117e87805a`
- Replay #2 task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/14cdc57b98b441128f08833352b19e92` (exit `0`)
- Post-restart verification task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/72f4fd0f44b0411692122ea08fbc16aa` (exit `0`)

### Application/Platform Postchecks

- ECS remained `1/1/0`, rollout `COMPLETED`
- Target group converged to a single healthy production target
- Alarms remained `15 OK`, `0 ALARM`
- RDS remained `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Latest restorable time continued advancing

### Safety Boundary Confirmation

- No task-definition image/config change for production web service (remained `:91`)
- No RDS setting mutation
- No schema migration during this phase
- No secrets/IAM/network/ALB configuration changes during this phase
- No payout enablement and no Woo production webhook enablement
