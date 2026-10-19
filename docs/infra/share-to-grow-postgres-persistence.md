# Share-to-Grow PostgreSQL persistence

## Architecture

Share-to-Grow repository operations use the asynchronous `FoundationStateStore`
interface. The filesystem adapter delegates to the existing revisioned JSON
envelope implementation. The PostgreSQL adapter stores the same aggregate
envelope in `public.genesis_foundation_state`; it does not change allocation,
refund, reversal, or payout-entitlement rules.

The PostgreSQL row keeps the complete Share-to-Grow state as JSONB, including
participants, tracking identities, rule versions, ledger entries, source-event
receipts, processed commerce lines, payout entitlements, and commerce
adjustments. This preserves optional fields such as rule snapshots, sale minor
units, reversal source IDs, brand-loss data, and entitlement reversal state.

## Backend selection and connection

`GENESIS_STATE_BACKEND=filesystem` selects filesystem persistence.
`GENESIS_STATE_BACKEND=postgres` selects PostgreSQL. When unset, the existing
filesystem behavior remains the default. Any other configured value fails
closed. A PostgreSQL connection or schema failure is surfaced as a persistence
error; it never falls back to local files.

PostgreSQL uses the existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`,
and `DB_PASSWORD` secret/environment names. TLS certificate verification is
enabled; `GENESIS_RDS_CA_CERT` may contain a PEM certificate or the path to one.
The application pool is bounded to five connections with connection and
statement timeouts. Credentials and full connection strings are never logged.

## Migration and recovery

Migrations are managed by `node-pg-migrate`. The first migration creates the
state-envelope table. Migrations are an explicit pre-start operation, not an
application-startup side effect:

```text
GENESIS_ENVIRONMENT=staging npm run migrate:foundation-state -- up
```

The migration runner refuses `GENESIS_ENVIRONMENT=production`. The first
migration is intentionally irreversible because dropping the table would
destroy financial history; recover by restoring and validating a backup.
Never run the migration against production as part of staging certification.

`scripts/import-foundation-state.mjs` reads and validates a source JSON envelope
without modifying it, reports a SHA-256 checksum and collection counts, and
refuses an occupied destination namespace. Start with `--dry-run`; a real
import additionally requires `GENESIS_ENVIRONMENT=staging` and
`--confirm-staging-target`. Both `GENESIS_STAGING_DATABASE_HOST` and
`GENESIS_STAGING_DATABASE_NAME` must exactly match the configured connection
target; production-looking targets are also rejected. These expected target
identifiers must come from the approved staging database record, not from the
database connection configuration being checked.
No production import has been run.

## Atomicity and concurrency

Each state save is one conditional PostgreSQL statement. Initial revision zero
uses insert-if-absent; subsequent writes update only when the stored revision
matches `expectedRevision`. PostgreSQL row-level atomicity makes the state
envelope and revision change indivisible across ECS tasks. A stale write raises
`FoundationPersistenceConflictError`; it is not automatically retried with
stale economics.

An order's receipt, all processed lines, ledger entries, and entitlements are
committed in one state revision. An adjustment's receipt, adjustment record,
reversal ledger entries, and entitlement transitions are committed together.
Ledger entries remain append-only; refunds/cancellations append reversal
entries and update only the entitlement lifecycle required by the existing
policy.

## Health and observability

`/api/health` remains a liveness endpoint and does not depend on PostgreSQL.
`/api/ready` checks that the selected state backend is usable and returns 503
for unavailable PostgreSQL or a missing schema. Persistence emits structured
backend selection, connection, read/write, revision-conflict, configuration,
and schema error codes without credentials or customer payloads.

## Staging certification gate

The isolated staging PostgreSQL target is provisioned separately from the
general staging infrastructure path. The controlled `Genesis Staging
Infrastructure` workflow has `postgres-plan` and `postgres-apply` modes; the
apply mode requires the exact `APPLY-STAGING-POSTGRES` confirmation. Both modes
run the existing staging plan gate first. An administrator must apply the repository's narrowly scoped policy `03` and
the dedicated PostgreSQL policy `05` before the workflow can create database
resources:

```bash
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-data-policy
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-postgres-policy
```

The database-only path is restricted to the staging account and VPC, two
approved private subnets, a single-AZ encrypted PostgreSQL 16 instance, a
staging-only security group allowing only TCP/5432 from the staging web task
group (no ingress from CIDRs and no outbound rules), and the
`genesis/staging/postgres` application secret. RDS default PostgreSQL 16
parameter and option groups are explicitly scoped in IAM because RDS checks
those associated resources during instance creation. The RDS-managed master
secret is not exposed to the application role. Runtime secret binding and the
Share-to-Grow deployment are deliberately deferred to a separately approved
phase. EFS remains the active staging persistence path until certification.
No database resources are created by `postgres-plan`.

### Pre-cutover in-VPC certification task

The workstation cannot reach the private RDS endpoint, so live migration,
integration, concurrency, and import checks must run from an isolated one-off
Fargate task inside the staging VPC. The dedicated
`Dockerfile.postgres-certification` and
`infra/staging/postgres-certification-task-definition.template.json` describe
that task; they do not change the application image or staging service. The
task has no ports or public IP, mounts only the existing foundation EFS path
read-only, and does not set `GENESIS_STATE_BACKEND`.

Before the task can be registered or started, review
`infra/staging/postgres-certification-permissions.plan.json` and approve only
the listed grants: `ecs:RunTask` for the certification task family in the
existing staging cluster, and `secretsmanager:GetSecretValue` for the exact
staging application and RDS-managed master secret ARNs on the staging
execution role. The existing staging provisioning path creates the application
secret but not the PostgreSQL `genesis_app` role. The certification task only
creates that role when absent; if it already exists, its supplied credentials
must authenticate successfully and the task never resets its password.
`kms:Decrypt`, ECS service or task-stop access, ECS Exec, EFS mutation access,
and task-role permissions are not required by this design.
After the approved IAM additions are ready to be applied, the dedicated
administrator refresh mode is:

```text
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-postgres-certification-permissions
```

It updates only the existing staging compute policy version and the named
inline secret-read policy on the staging execution role. It refuses to replace
a differing inline policy and verifies both policy documents after refresh.

The task validates the private database endpoint and EFS source, applies the
foundation migration as the application role, verifies schema and migration
metadata, runs opt-in real-database adapter/reconnect/concurrency tests, then
validates, imports, compares, and safely rejects replay of the EFS envelope.
It emits counts and hashes rather than source records and does not print
secret values. This is a pre-cutover certification only: do not start the task
until the permission plan is approved, and do not deploy or switch the staging
runtime to PostgreSQL as part of this phase.

The planning estimate is approximately **$15/month** for `db.t4g.micro`, 20 GiB
of gp3 storage, and Secrets Manager. This is approximate only; review the
current AWS plan and pricing before applying chargeable resources, including
the instance, storage, and both Secrets Manager secrets. Do not provision based
only on this estimate. Certification then requires:

1. Provision or identify a staging-only database/schema and credentials; verify
   its hostname, database identity, security-group path, and TLS CA. Never use
   production RDS.
2. Apply the migration with the staging migration command.
3. Start from an empty Share-to-Grow namespace, or use the import utility's
   dry-run and explicitly approved staging import.
4. Deploy only to staging with `GENESIS_STATE_BACKEND=postgres`; keep filesystem
   persistence available as the configured staging fallback until certification
   is accepted. There is no automatic runtime fallback from PostgreSQL.
5. Run real PostgreSQL integration tests, concurrent-writer tests, and the
   complete Share-to-Grow economic/refund/cancellation certification suite.
6. If certification fails, explicitly switch the staging deployment back to its
   existing EFS-backed filesystem persistence. Do not copy PostgreSQL state
   back over an existing filesystem namespace without a reviewed export/import.

Production Share-to-Grow cannot be enabled until PostgreSQL persistence
certification passes. Automated external payouts remain disabled; this
persistence change introduces no external money movement.
