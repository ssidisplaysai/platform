# Share-to-Grow Secure Snapshot Export Runbook (Staging)

## Scope and non-goals

- Scope: staged, read-only export of Share-to-Grow repository snapshots for deterministic dry-run reconciliation.
- Non-goals: no production export, no migration apply, no runtime cutover, no financial mutation.

## Required operator identity

- Use a non-root operator principal approved to assume `StagingSnapshotOperatorRole`.
- Root credentials are forbidden for export execution.

## Required roles

- `StagingSnapshotOperatorRole`
  - Can only invoke broker function URLs with AWS_IAM auth.
  - Has no direct `ecs:RunTask`, `iam:PassRole`, or task override authority.
- `SnapshotLaunchBrokerExecutionRole`
  - Validates run authorization, enforces fixed staging task/network config, and performs controlled `ecs:RunTask`.
- `SnapshotReaderBrokerExecutionRole`
  - Validates run authorization and assumes reader role with server-controlled `reconciliation-run-id` tag.

## Required database reader role (provision separately)

Provision a dedicated PostgreSQL role and secret for snapshot export only:

```sql
-- create role/login and bind only to staging database (separate approval required)
CREATE ROLE genesis_share_to_grow_snapshot_reader LOGIN PASSWORD '<managed-by-secrets-manager>';
REVOKE ALL ON DATABASE genesis_staging FROM genesis_share_to_grow_snapshot_reader;
GRANT CONNECT ON DATABASE genesis_staging TO genesis_share_to_grow_snapshot_reader;
\c genesis_staging
REVOKE ALL ON SCHEMA public FROM genesis_share_to_grow_snapshot_reader;
GRANT USAGE ON SCHEMA public TO genesis_share_to_grow_snapshot_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM genesis_share_to_grow_snapshot_reader;
GRANT SELECT ON TABLE public.genesis_foundation_state TO genesis_share_to_grow_snapshot_reader;
ALTER ROLE genesis_share_to_grow_snapshot_reader NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS;
```

Hard requirements:
- exporter task must use `SNAPSHOT_DB_READER_SECRET_ARN` only,
- `DB_USERNAME` must equal `genesis_share_to_grow_snapshot_reader`,
- exporter refuses to run if username mismatch is detected.
- `StagingSnapshotExporterRole`
  - Reads staging sources and uploads encrypted artifacts.
- `StagingSnapshotReaderRole`
  - Reads run-scoped encrypted artifacts and decrypts them locally.

## Dedicated staging DB admin task boundary (draft)

- Use a dedicated one-off task family for DB admin diagnostics/provisioning design:
  - [s2g-db-role-provision-task-definition.template.json](../../infra/staging/s2g-db-role-provision-task-definition.template.json)
  - [s2g-db-role-provision-permissions.plan.json](../../infra/staging/s2g-db-role-provision-permissions.plan.json)
- Use a dedicated launcher control plane for privileged diagnostic execution:
  - [staging-s2g-db-admin-launcher-stack.mjs](../../infra/staging/s2g-db-admin-launcher/cdk/staging-s2g-db-admin-launcher-stack.mjs)
  - [diagnostic-launcher-core.mjs](../../infra/staging/s2g-db-admin-launcher/broker/diagnostic-launcher-core.mjs)
  - [s2g-db-admin-launcher-permissions.plan.json](../../infra/staging/s2g-db-admin-launcher-permissions.plan.json)
- The default command is diagnostic-only (`--diagnose-admin-readonly`) and requires:
  - fixed staging host/database,
  - `DB_ADMIN_USERNAME` + `DB_ADMIN_PASSWORD` from the exact staging RDS-managed admin secret,
  - TLS CA verification,
  - read-only transaction checks before metadata inspection.
- Direct operator `ecs:RunTask` with caller overrides is considered unsafe for privileged DB operations.
  Use a fixed-configuration launcher control plane for actual execution authorization.

## Deployment approval gate (before any apply)

1. Security review approved for S3/KMS and retention controls.
2. IAM least-privilege review approved.
3. Staging-only stack diff reviewed.
4. Explicit sign-off that no production stack updates are included.
5. Broker authorization-record governance approved (who can create/approve run records and TTL policy).

## Two-stage broker activation

- `BrokerActivationState=DISABLED` (default bootstrap state):
  - launch broker rejects all requests with `BROKER_DISABLED`,
  - reader broker rejects all requests with `READER_BROKER_DISABLED`,
  - enabled-only broker permissions are not attached.
- `BrokerActivationState=ENABLED` (separately approved activation state):
  - requires exact approved snapshot task ARN with family `genesis-staging-snapshot-export` and revision,
  - enables broker launch/reader invocation and enabled-only ECS/STS permissions.

## Snapshot acquisition and encrypted export

1. Assume `StagingSnapshotOperatorRole`.
2. Verify target account and region.
3. Invoke launch broker URL with signed IAM request and only `runId`.
4. Broker validates:
   - caller identity,
   - run authorization record (`APPROVED` + operator binding),
   - exact approved task definition revision,
   - digest-pinned container image,
   - fixed staging network config and `enableExecuteCommand=false`,
   - launch claim state (`APPROVED -> CLAIMED`) with short claim TTL to prevent concurrent duplicate launches.
6. Retry behavior:
   - if broker returns `CLAIM_IN_PROGRESS`, wait for claim TTL window and retry same `runId`,
   - broker `RunTask` uses `clientToken=runId` so ambiguous retry cannot create duplicate tasks.
7. Confirm launched task is in staging cluster/subnets/security group only.
8. Read CloudWatch logs and verify only metadata appears:
   - runId
   - namespace
   - revision/schemaVersion/updatedAt
   - raw/canonical SHA256 hashes
   - collection counts
9. Confirm snapshot objects written only under:
   - `exports/<reconciliation-run-id>/postgres.snapshot.json`
   - `exports/<reconciliation-run-id>/filesystem.snapshot.json`

## Secure download and local handling

1. Invoke reader broker URL with signed IAM request and `runId`.
2. Broker validates operator-to-run binding and issues temporary credentials for reader role with server-controlled `reconciliation-run-id` session tag.
3. Broker responses for credentials include `Cache-Control: no-store` and must never be persisted in shell history, ticket systems, or shared notes.
4. Export credentials only into an ephemeral local shell/session; unset environment variables immediately after download:
   - `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN` (POSIX)
   - `Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN` (PowerShell)
5. Download objects into a protected local directory outside the repository.
6. Verify local SHA256 hashes against exporter metadata.
7. Do not upload raw snapshots to GitHub, CI artifacts, or chat outputs.

## Dry-run reconciliation (two-pass determinism)

1. Run [share-to-grow-reconciliation-dry-run.mjs](../../scripts/share-to-grow-reconciliation-dry-run.mjs) once with both snapshots.
2. Run a second time with identical inputs.
3. Verify canonical manifest hash equality.
4. Produce a sanitized report only (no raw record disclosure).

## Revision/hash integrity checks

1. Capture source revisions/hashes at export time.
2. Re-check source revisions after export window where feasible.
3. If drift is detected, mark run BLOCKED and reacquire snapshots.

## Logging and audit requirements

- Keep CloudWatch logs metadata-only.
- Exporter failure logs must emit fixed failure codes only (no raw exception payloads).
- Launch and reader brokers must log metadata and fixed failure codes only.
- Enforce TLS and SSE-KMS for all snapshot artifact writes.
- Keep artifacts under short retention lifecycle.
- Track execution events in CloudTrail management events and S3 data-event plan.

## Artifact expiration and cleanup

- Bucket lifecycle expiration applies to `exports/` prefix.
- Expiration is not cryptographic erasure; backup/cached replicas may persist transiently per AWS internals.
- Local snapshot files must be deleted after report completion.
- Retain only sanitized manifests and metadata required for audit.

## Emergency stop conditions

Stop immediately if any of the following occur:
- account/region mismatch,
- non-staging resource target detected,
- missing SSE-KMS headers,
- wrong KMS key,
- overwrite attempt detected,
- raw financial records appear in logs,
- revision drift during acquisition.
