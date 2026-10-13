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

## Production Share-to-Grow Dedicated DB Principal and Secret (Completed)

- Caller identity: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Safety baseline before mutation:
  - ECS service remained stable on `genesis-production-web:95` (`1/1/0`, rollout `COMPLETED`)
  - RDS remained `available`, `MultiAZ=true`, `PendingModifiedValues={}`
  - Pre-existing role check: `genesis_share_to_grow_app` absent (`ROLE_EXISTS=0`)
  - Canonical namespace baseline: `schema_version=1`, `revision=1`, `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`

### Applied SQL Mutations (Bounded)

- One-off task definition: `genesis-production-db-admin-psql:1`
- Mutation task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/5b33ffe0119d4096b4b3f1f6d952081c` (exit `0`)
- Statements applied:
  - `CREATE ROLE genesis_share_to_grow_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '<generated>'`
  - `GRANT CONNECT ON DATABASE genesis TO genesis_share_to_grow_app`
  - `GRANT USAGE ON SCHEMA public TO genesis_share_to_grow_app`
  - `GRANT SELECT, INSERT, UPDATE ON TABLE public.genesis_foundation_state TO genesis_share_to_grow_app`

### Principal Verification

- Role attributes validated:
  - `rolsuper=false`
  - `rolcreatedb=false`
  - `rolcreaterole=false`
  - `rolreplication=false`
  - `rolbypassrls=false`
  - `rolcanlogin=true`
  - `rolinherit=false`
- Privilege matrix validated:
  - `CONNECT=true`
  - schema `USAGE=true`
  - table `SELECT=true`
  - table `INSERT=true`
  - table `UPDATE=true`
  - table `DELETE=false`
  - schema `CREATE=false`

### Dedicated Secret Creation

- Name: `genesis/production/share-to-grow/postgres-app`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`
- VersionId: `73ec0245-90d6-481c-afc9-0fc682e15dd7`
- Tags:
  - `Environment=production`
  - `Application=Genesis`
  - `Purpose=ShareToGrowPostgresApplicationRuntime`
- Payload keyset verification: `username`, `password`, `host`, `port`, `dbname`

### Strict TLS + Functional Certification as New Principal

- Probe task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/959570845dec44be99719466cddad2e3` (exit `0`)
- TLS mode: `sslmode=verify-full` with in-task OpenSSL-derived RDS certificate chain.
- Identity verification:
  - `current_user=genesis_share_to_grow_app`
  - `current_database=genesis`
- Transactional positive probe:
  - `BEGIN -> INSERT -> UPDATE(revision predicate) -> SELECT verify -> ROLLBACK`
  - Probe namespace: `stg-principal-cert-6d380633c705416185d0d1ad75116bf9`
  - Post-rollback probe namespace row count: `0`
- Negative privilege probes:
  - `DELETE`: denied as expected
  - `TRUNCATE`: denied as expected
  - `CREATE TABLE`: denied as expected
  - `ALTER OWNER`: denied as expected

### Post-Mutation Invariants

- Postcheck task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/866da9b034c94123939f944c61a36bbc` (exit `0`)
- Canonical namespace remained unchanged:
  - `schema_version=1`, `revision=1`, `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`
- Service unchanged:
  - task definition remained `genesis-production-web:95`
  - desired/running/pending remained `1/1/0`
  - rollout remained `COMPLETED`
- RDS unchanged:
  - status `available`
  - `MultiAZ=true`
  - `PendingModifiedValues={}`

## Share-to-Grow Production ECR + IAM Isolation (Completed)

- Window: `2026-10-12T20:56Z` to `2026-10-12T21:09Z`
- Caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Authorized mutation boundary observed:
  - created dedicated STG ECR repository
  - created dedicated STG execution/task IAM roles
  - attached minimal execution-role policies
  - optional immutable image push for provenance
  - no ECS service/task-definition/network/ALB/DNS/Woo/payout mutation

### Pre-Gate and Preexistence

- ECR `genesis-share-to-grow-production`: absent before phase
- Execution role `GenesisShareToGrowProductionExecutionRole`: absent before phase
- Task role `GenesisShareToGrowProductionTaskRole`: absent before phase
- Canonical STG state before phase:
  - `schema_version=1`
  - `revision=1`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - secondary DB hash `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`

### ECR Resource

- ARN: `arn:aws:ecr:us-west-2:452630323448:repository/genesis-share-to-grow-production`
- URI: `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-share-to-grow-production`
- Config:
  - `scanOnPush=true`
  - `encryptionType=AES256`
  - `imageTagMutability=IMMUTABLE`

### Execution Role Resource

- ARN: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionExecutionRole`
- Trust: `ecs-tasks.amazonaws.com` only
- Managed policies:
  - `AmazonECSTaskExecutionRolePolicy`
- Inline policies:
  - `ShareToGrowDbSecretReadOnly`:
    - `Action`: `secretsmanager:GetSecretValue`
    - `Resource`: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`

### Execution Role Secret Simulation

- STG DB secret: `allowed`
- PF production postgres-app: `implicitDeny`
- PF OpenAI: `implicitDeny`
- PF WordPress: `implicitDeny`
- production admin/foundation DB secret: `implicitDeny`
- staging postgres: `implicitDeny`
- staging Woo: `implicitDeny`
- future STG Woo (hypothetical): `implicitDeny`
- wildcard resource check `genesis/production/share-to-grow/*`: `implicitDeny`

### Task Role Resource

- ARN: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionTaskRole`
- Trust: `ecs-tasks.amazonaws.com` only
- Managed policies: none
- Inline policies: none

Task role negative boundary simulation:

- `secretsmanager:GetSecretValue` on all tested secret targets: `implicitDeny`
- `s3:ListAllMyBuckets`: `implicitDeny`
- `ecs:UpdateService`: `implicitDeny`
- `iam:PassRole`: `implicitDeny`
- `rds:ModifyDBInstance`: `implicitDeny`
- `secretsmanager:ListSecrets`: `implicitDeny`

### Optional Immutable Provenance Image Push

- Source SHA: `33719ae2efb2e8dca098648e945ae265edd92e5d`
- Dockerfile: repo root `Dockerfile`
- Build arg: `GIT_COMMIT=33719ae2efb2e8dca098648e945ae265edd92e5d`
- Repository: `genesis-share-to-grow-production`
- Tag: `s2g-prod-33719ae2-20261012T210232Z`
- Digest: `sha256:647cd0557ab9d4e18ff3ec422badde60697c435282583ba8fcab1ed27a0abe2a`

Image reconfirmation:

- STG compiled webhook route present
- health route present
- RDS CA bundle present (`/app/certs/rds-global-bundle.pem`)
- Page Factory monorepo markers absent
- no embedded runtime secret env markers

### Post-Gate / No-Drift

- Canonical STG state remained unchanged:
  - `schema_version=1`
  - `revision=1`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Web service remained unchanged by this phase:
  - `genesis-production-web:95`
  - `1/1/0`
  - rollout `COMPLETED`

## Share-to-Grow Production Runtime Foundation Scaffolding (Completed)

- Caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Scope: SG + RDS ingress + TG + log/metrics/alarms/dashboard + task definition + bounded one-off tasks
- Out of scope preserved: no ECS service creation, no ALB rule/listener attachment, no DNS, no Woo ingress/secret binding, no payout enablement.

### Infrastructure Created

- Security group:
  - `genesis-share-to-grow-production-sg` (`sg-0e76412b38ac2f535`)
  - ingress TCP `3000` from ALB SG `sg-08117e5cf7cef2d09` only
  - egress: TCP `443` to `0.0.0.0/0`, TCP `5432` to RDS SG `sg-0ef556836f34707ee`, UDP/TCP `53` to `10.42.0.0/16`
- RDS SG ingress:
  - added TCP `5432` source `sg-0e76412b38ac2f535` with description `Genesis Share-to-Grow production PostgreSQL access`
  - existing Page Factory ingress source (`sg-02f456f2dea97f1be`) preserved
- Target group:
  - `genesis-s2g-production`
  - ARN `arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-s2g-production/55f036c68e053f00`
  - `HTTP:3000`, target type `ip`, health path `/api/health`, matcher `200`
  - deregistration delay `30`
  - not attached to listeners; no registered targets
- Log group:
  - `/genesis/share-to-grow/production`
  - retention `30 days`

### Metrics / Alarms / Dashboard

- Metric namespace: `Genesis/ShareToGrow/Production`
- Metric filters created (`9` total):
  - config/connection/read/write/schema/revision conflict failure markers
  - backend-required and tls-required production guard markers
  - DB auth/permission marker (`databaseErrorCode` `28P01|42501`)
- Alarms created (`11`, prefix `genesis-s2g-prod-`):
  - `ecs-livetaskcount-low`
  - `alb-unhealthy-hosts`
  - `alb-target-5xx`
  - `alb-elb-5xx`
  - app persistence config/connection/read/write/schema/revision alarms
  - app db auth/permission alarm
- All alarms configured with `treatMissingData=notBreaching`; pre-service classification: `PRECREATED_NOT_ACTIVE`
- Dashboard:
  - name `genesis-share-to-grow-production`
  - widgets `5`
  - includes ECS/TG/ALB/STG custom metrics + shared RDS contextual metrics

### Task Definition Registered

- `genesis-share-to-grow-production:1`
- ARN `arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-share-to-grow-production:1`
- Container: `GenesisShareToGrowRuntime`
- Image digest pinned:
  - `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-share-to-grow-production@sha256:647cd0557ab9d4e18ff3ec422badde60697c435282583ba8fcab1ed27a0abe2a`
- Task role: `GenesisShareToGrowProductionTaskRole`
- Execution role: `GenesisShareToGrowProductionExecutionRole`
- Task size: `cpu=512`, `memory=1024`
- Runtime platform: `X86_64`, `LINUX`, `FARGATE`
- Env:
  - `NODE_ENV=production`
  - `GENESIS_ENVIRONMENT=production`
  - `GENESIS_STATE_BACKEND=postgres`
  - `GENESIS_RDS_CA_CERT=/app/certs/rds-global-bundle.pem`
  - `PORT=3000`
  - `HOSTNAME=0.0.0.0`
- Secret bindings (key selectors from STG DB secret):
  - `DB_HOST:host`
  - `DB_PORT:port`
  - `DB_NAME:dbname`
  - `DB_USERNAME:username`
  - `DB_PASSWORD:password`
- Woo secret binding: none

`GENESIS_STONER_GYM_RECRUITED_CREATORS` source audit result:

- runtime reads with `?? ""` default
- classified optional (safe default), not bound in task definition.

### Secret Payload Correctness Fix (Coupled Remediation)

- Initial one-off task secret injection failed because existing secret payload used non-JSON object syntax.
- Corrected by writing valid JSON payload to the same secret (no ARN/name change).
- Result: ECS JSON key selectors resolved correctly for DB env injection.

### One-off Runtime Certification

- DB connectivity probe task:
  - ARN `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/1f99cf05aaa84e579d0accb93c0a6cca`
  - `current_user=genesis_share_to_grow_app`
  - `current_database=genesis`
  - strict TLS pass
  - `SELECT 1` pass
  - no writes
- App boot probe task:
  - ARN `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/81b39672bb2144a79db43945ce3a11f7`
  - Next.js reached ready state
  - no persistence guard failures
  - no DB auth/permission errors
  - no secret retrieval failures
  - Woo secret not required for process boot
- Health endpoint proof:
  - deferred (no public ingress introduced in this scaffolding phase)

### Canonical State and Isolation Postchecks

- Canonical namespace remained unchanged:
  - `schema_version=1`
  - `revision=1`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Dedicated STG target group isolation:
  - listener attachments `0`
  - registered targets `0`
  - `PUBLIC_STG_INGRESS=NONE`
- Page Factory no-drift validation:
  - PF service, target group, alarms, and dashboard remained intact and unmodified by this phase.

## Share-to-Grow Production Isolated ECS Service Certification (Completed)

- Caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Service: `genesis-share-to-grow-production`
- Cluster: `genesis-production`
- Task definition: `genesis-share-to-grow-production:1`

### Constraint + Approved Override

- AWS ECS `CreateService` with target group failed while TG had no ALB association:
  - `InvalidParameterException` (`target group ... does not have an associated load balancer`)
- With explicit operator approval, phase continued by creating service without LB attachment and deferring TG health certification to ingress phase.

### Service Convergence

- Service ARN: `arn:aws:ecs:us-west-2:452630323448:service/genesis-production/genesis-share-to-grow-production`
- Convergence duration: `50s`
- End state: desired/running/pending `1/1/0`
- Deployment: `COMPLETED`, single deployment
- Running task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/a953ff13d95c4812b7ef9b25053df999`
- Task ENI/IP/AZ:
  - `eni-01b6153493a7820c2`
  - `10.42.2.86`
  - `us-west-2a`

### Startup and Runtime Error Review

- Log group: `/genesis/share-to-grow/production`
- Stream: `runtime/GenesisShareToGrowRuntime/a953ff13d95c4812b7ef9b25053df999`
- Startup marker observed: `✓ Ready in 423ms`
- No persistence guard/config/schema/conflict failures observed
- No DB auth/permission failures observed
- No secret retrieval failures observed

### Runtime Identity Proof

Bounded one-off identity probe:

- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/23facbf882944db5be4ad900b293b0ff`
- Verified:
  - backend `postgres`
  - strict CA path `/app/certs/rds-global-bundle.pem`
  - DB principal `genesis_share_to_grow_app`
  - database `genesis`

### Live Canonical Application Read (Adapter-Level)

- Read mechanism: same-image runtime module invocation of foundation store adapter (`/app/probe-dist/src/modules/foundation/foundation-state-store.js`)
- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/0e99da18ec5948b7b394df051eb6e6e5`
- Result:
  - namespace `share-to-grow-repository`
  - `schemaVersion=1`
  - `revision=1`
  - all 8 collection counts `0`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Raw SQL was not the only proof.

### State Immutability

Before/after values remained identical:

- `schema_version=1`
- `revision=1`
- `updated_at=2026-10-12 14:46:21.214147+00`
- canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- all counts remained zero

### Target Group / Ingress Isolation

- Service load balancer attachments: none
- TG `genesis-s2g-production` registered targets: `0`
- Listener rule attachments to TG: `0`
- DNS created: none
- `PUBLIC_STG_INGRESS=NONE`

### Alarm State Classification (11 STG alarms)

- All `genesis-s2g-prod-*` alarms in `OK`, with `treatMissingData=notBreaching`
- Classification:
  - ECS livetascount: `ACTIVE`
  - ALB/TG request and 5xx alarms: `PRECREATED_NOT_ACTIVE` (no ingress/listener yet)
  - persistence and DB-auth metrics: `ACTIVE` (service + log source active)
- Actual alarm count due service defect: `0`

### 15-Minute Stability Certification

- Window:
  - start `2026-10-12T22:23:45.5413961Z`
  - end `2026-10-12T22:39:03.5720822Z`
  - duration `15m`
- Across four samples:
  - service stayed `1/1/0`
  - rollout stayed `COMPLETED`
  - task ARN unchanged (no restart/replacement)
  - no deployment replacement
  - no persistence/auth/secret errors
  - RDS stayed `available`, `MultiAZ=true`, `PendingModifiedValues={}`
  - canonical state remained unchanged

### Woo / Payout Safety

- Woo secret bound to service task: no
- Woo ingress: none
- `sourceEventReceipts=0`
- `WOO_PRODUCTION_ENABLED=NO`
- payout automation remains disabled
- `payoutEntitlements=0`

### Page Factory Drift Check (Service Phase)

- STG-caused changes to PF ECS/task/ECR/IAM/secrets/ALB/DB/monitoring/source: none
- `PAGE_FACTORY_DRIFT_RISK=NO`

## Share-to-Grow Production Health-Only Ingress (AWS-Side Complete; External DNS/Cert Pending)

- Phase objective: expose only `https://share-to-grow.glwplatform.com/api/health` while hard-blocking all other STG hostname paths (especially Woo webhook).
- Outcome: `SHARE_TO_GROW_HEALTH_ONLY_INGRESS=BLOCKED_HEALTH` (public DNS+strict TLS pending external DNS + ACM validation).

### Implemented Mutations

1. Requested dedicated ACM cert for `share-to-grow.glwplatform.com`:
   - `arn:aws:acm:us-west-2:452630323448:certificate/3218d97a-c585-47ab-bbe9-3633e5d44252` (`PENDING_VALIDATION`)
2. Created HTTPS listener rules:
   - priority `13` catch-all host block (created first), fixed `404 Not Found`
   - priority `12` host+path health forward to TG `genesis-s2g-production`
3. Performed exactly one ECS `UpdateService` LB attachment:
   - added mapping `GenesisShareToGrowRuntime:3000` -> `genesis-s2g-production`
4. No PF default action/target changes and no Woo enablement changes.

### Evidence Summary

- DNS authority: no Route53 `glwplatform.com` zone in-account (`external DNS`)
- Current public resolution for `share-to-grow.glwplatform.com`: `NXDOMAIN`
- Existing listener certs cover only `app.glwplatform.com` and `staging.glwplatform.com` (no wildcard)
- New cert attach attempt while pending returned `UnsupportedCertificate` (expected until issuance)
- Service converged to `1/1/0` and rollout `COMPLETED`
- Target group now has exactly one healthy STG target (`10.42.2.136:3000`, `us-west-2a`)
- Host-preserving ALB-routed checks proved isolation behavior:
  - `/api/health` => `200` `{"status":"ok"}`
  - `/`, `/does-not-exist`, Woo GET/POST path => fixed `404` (`Not Found`)
  - webhook requests did not reach STG application logs
- Canonical state remained unchanged:
  - `schema_version=1`, `revision=1`, `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all collection counts remained `0`
- Alarm state at close: all 11 `genesis-s2g-prod-*` alarms `OK`, `0 ALARM`
- Stability window (16.47m, four samples): service/target/health/blocking behavior stable, no task restarts, no runtime DB/persistence/secret failures, RDS `available` and `MultiAZ=true`.

### External Handoff Required to Reach PASS

- Create DNS hostname record externally:
  - `share-to-grow.glwplatform.com` -> `Genesi-Runti-8hL31AGbz6rt-743202067.us-west-2.elb.amazonaws.com`
- Create ACM validation CNAME externally:
  - `_fea44451dbc7bacd728a8edcad25cf94.share-to-grow.glwplatform.com.`
  - `_1d854ad3551f80165b012391846d30e7.wzccmgtwzk.acm-validations.aws.`
- After ACM status becomes `ISSUED`, attach cert to ALB listener as additional SNI cert, then rerun strict public HTTPS validation for `/api/health`.

### Completion Update (PASS)

External DNS and ACM validation were completed, then certification was rerun.

- ACM certificate `arn:aws:acm:us-west-2:452630323448:certificate/3218d97a-c585-47ab-bbe9-3633e5d44252` reached `ISSUED`
- Certificate attached to production ALB HTTPS listener as additional SNI cert
- Public DNS resolution succeeded for hostname + ACM validation record
- Strict TLS hostname validation passed for `share-to-grow.glwplatform.com`
- Public route checks:
  - `/api/health` -> `200` (`{"status":"ok"}`)
  - `/`, Woo GET/POST path, and arbitrary path -> `404` (fixed-response block)
- ECS steady state and target health remained green:
  - service `1/1/0`, rollout `COMPLETED`
  - one healthy target in dedicated STG TG
- Alarms: all 11 STG alarms `OK`, `0 ALARM`
- Canonical state remained unchanged (`schema_version=1`, `revision=1`, same SHA-256, all counts zero)

Final classification update:

- `SHARE_TO_GROW_HEALTH_ONLY_INGRESS=PASS`

## Share-to-Grow Production Woo Secret + Authentication (Completed)

- Classification: `SHARE_TO_GROW_WOO_AUTHENTICATION=PASS`
- Scope of change:
  1. created dedicated production Woo webhook secret
  2. narrowed STG execution role to DB secret + new Woo secret only
  3. registered STG task definition `genesis-share-to-grow-production:2` with Woo secret binding
  4. rolled STG service to `:2`
  5. certified authentication behavior internally
  6. preserved public Woo route block (`404`) and canonical immutability

### Key Evidence

- Secret:
  - name `genesis/production/share-to-grow/woocommerce-webhook`
  - ARN `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/woocommerce-webhook-dU3KMX`
  - version `4aeefdb8-1280-4373-a098-e1fb8090aca9`
  - tags `Environment=production`, `Application=GenesisShareToGrow`, `Purpose=WooCommerceWebhookAuthentication`
  - plaintext exposure: none
- IAM simulation:
  - allow only STG DB + STG Woo secret
  - PF DB/OpenAI/WordPress, admin DB, staging DB, staging Woo, and `*` all `implicitDeny`
- Task definition diff `:1 -> :2`:
  - only added `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` secret binding to new STG Woo secret ARN
  - image digest unchanged
- Service rollout:
  - old task `.../4b9cdd13448749cd942a864867ef5991`
  - new task `.../34f21e9e6395455c86b8d3aeee4515f4`
  - convergence `172s`, steady `1/1/0`, rollout `COMPLETED`, target healthy
- Public Woo route remains blocked:
  - GET/POST `/api/share-to-grow/woocommerce/webhook` -> `404`
  - no matching Woo processing logs
- Internal auth certification (bounded, no public ingress):
  - missing signature rejected
  - malformed signature rejected
  - wrong signature rejected
  - correct HMAC signature accepted
  - source-level constant-time verification path confirmed (`timingSafeEqual`)
- Canonical state unchanged before/after:
  - `schema_version=1`, `revision=1`, same `updated_at`
  - SHA-256 unchanged: `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all canonical counts remain zero
- Stability window (`15.43m`): all 4 samples healthy; alarms `0 ALARM`; no DB/persistence/secret retrieval failures; RDS `available`, `MultiAZ=true`.

### Safety Posture After Phase

- `WOO_SECRET_READY=YES`
- `WOO_AUTH_CERTIFIED=YES`
- `WOO_PUBLIC_INGRESS_ENABLED=NO`
- Woo events processed: `0`
- Payouts: disabled; no side effects
- Page Factory drift: none (`PAGE_FACTORY_DRIFT_RISK=NO`)
