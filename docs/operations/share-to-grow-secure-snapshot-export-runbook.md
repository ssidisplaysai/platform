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
  - [s2g-db-admin-diagnostic-network.plan.json](../../infra/staging/s2g-db-admin-diagnostic-network.plan.json)
  - [s2g-db-admin-diagnostic-image.plan.json](../../infra/staging/s2g-db-admin-diagnostic-image.plan.json)
  - [s2g-db-admin-diagnostic-provisioning-package.json](../../infra/staging/s2g-db-admin-diagnostic-provisioning-package.json)
- Provision prerequisite infrastructure in an isolated CREATE-only stack:
  - stack: `GenesisStagingS2gDbAdminDiagnosticPrerequisitesStack`
  - synth: `npm run synth:staging:s2g-db-admin-diagnostic-prerequisites`
  - reviewed change set type: `CREATE` only (no execution without separate approval)
  - template source: [staging-s2g-db-admin-diagnostic-prerequisites-stack.mjs](../../infra/staging/s2g-db-admin-diagnostic-prerequisites/cdk/staging-s2g-db-admin-diagnostic-prerequisites-stack.mjs)
- Use a dedicated launcher control plane for privileged diagnostic execution:
  - [staging-s2g-db-admin-launcher-stack.mjs](../../infra/staging/s2g-db-admin-launcher/cdk/staging-s2g-db-admin-launcher-stack.mjs)
  - [diagnostic-launcher-core.mjs](../../infra/staging/s2g-db-admin-launcher/broker/diagnostic-launcher-core.mjs)
  - [s2g-db-admin-launcher-permissions.plan.json](../../infra/staging/s2g-db-admin-launcher-permissions.plan.json)
  - When `LauncherActivationState=ENABLED`, operator invocation policy must include both:
    - `lambda:InvokeFunctionUrl` with `StringEquals {"lambda:FunctionUrlAuthType":"AWS_IAM"}`
    - `lambda:InvokeFunction` with `Bool {"lambda:InvokedViaFunctionUrl":"true"}`
  - Both actions must remain scoped to the exact launcher function ARN and removed when `LauncherActivationState=DISABLED`.
- DB admin launcher authorization model (single-use, fail-closed):
  - Launcher accepts only pre-created `AUTHORIZED` records; it cannot upsert unknown `runId`s.
  - Record contract requires:
    - `purpose=STAGING_DB_ADMIN_READONLY_DIAGNOSTIC`
    - `schemaVersion=2026-10-13`
    - exact approved task definition ARN, cluster ARN, image digest, and network identity
    - exact authorized operator ARN
    - `maxLaunchAttempts=1`
    - short `expiresAtEpoch` (default 300 seconds in administrative procedure)
  - Launcher consumes authorizations via atomic conditional transition:
    - `AUTHORIZED -> CLAIMED -> (LAUNCHED | LAUNCH_FAILED | OUTCOME_UNKNOWN)`
    - no transition back to `AUTHORIZED`
    - no reclaim-from-`CLAIMED` behavior
    - no automatic launcher retry once consumed
  - A `RunTask` throw or ambiguous result is recorded as `OUTCOME_UNKNOWN` where possible and remains consumed.
- Administrative authorization creation boundary (separate action, separate role):
  - Optional isolated identity stack for creator-boundary provisioning:
    - [staging-s2g-db-admin-authorization-identity-stack.mjs](../../infra/staging/s2g-db-admin-authorization-identity/cdk/staging-s2g-db-admin-authorization-identity-stack.mjs)
    - [s2g-db-admin-authorization-identity.plan.json](../../infra/staging/s2g-db-admin-authorization-identity.plan.json)
  - Canonical writer role is `genesis-staging-s2g-db-admin-authorization-writer-role` only.
  - The launcher stack must not create a second authorization writer role or export a creator-role output.
  - Restricted source role `AWSReservedSSO_GenesisS2GDiagAuthCreator_a8cbf54ac63d3f12` must retain `sts:AssumeRole` to the canonical writer role only.
  - Role scope: `dynamodb:PutItem` on `genesis-staging-s2g-db-admin-diagnostic-launches` only.
  - IAM condition scope for run IDs must be fail-closed:
    - `ForAllValues:StringLike` on `dynamodb:LeadingKeys` with `s2g-dbdiag-*` (no `IfExists` suffix),
    - plus `Null: {"dynamodb:LeadingKeys":"false"}` so missing key context does not pass.
  - Required write pattern (not yet deployed as writer service):
    - conditional put with `ConditionExpression=attribute_not_exists(runId)`
    - immutable launch scope fields listed above
    - `maxLaunchAttempts=1`
    - short expiry (`expiresAtEpoch` within 300 seconds of creation)
  - Offline authorization-request preparation (PowerShell 5.1-safe, no AWS calls):
    - script: [staging-s2g-db-admin-authorization-prepare.ps1](../../scripts/staging-s2g-db-admin-authorization-prepare.ps1)
    - template example: `s2g-db-admin-authorization-putitem-sample.json` remains demonstration-only and must not be treated as live authorization
    - reads a non-live template and writes a complete `put-item` request as UTF-8 **without BOM**
    - validates table/condition/attribute types, fixed task-image-network-account-region bindings, STS operator ARN shape, `maxLaunchAttempts=1`, and <= 5-minute expiry window
    - refuses placeholder approval references and expired windows
    - requires fresh values for each authorized attempt:
      - approval reference (for example, `INDEPENDENT_APPROVAL:<ref>` or `OWNER_APPROVAL:<ref>`)
      - recorded approval source and UTC timestamp in the audit package
      - unpredictable `runId`
      - exact current operator STS assumed-role ARN
      - current `createdAtEpoch` and `expiresAtEpoch`
    - output artifact can be used later with `--cli-input-json file://<absolute-path>` under separate approval
  - Example future execution command (for separately approved run only):
    - `aws dynamodb put-item --cli-input-json file://C:\secure-path\approved-s2g-dbdiag-putitem-request.json`
    - never place raw JSON inline in PowerShell commands
    - capture stdout/stderr/exit code and do not retry on failure/ambiguity
  - Residual governance risk:
    - account-level `AdministratorAccess` can bypass this boundary unless operations are restricted to independently approved, least-privilege roles.
  - If no existing restricted IAM/SSO principal satisfies this boundary, deployment is blocked until a dedicated restricted principal is created and separately approved.
  - For the identity stack, `RestrictedCreatorSourcePrincipalArn` is required and intentionally has no default; do not substitute AdministratorAccess.
  - Staging-only owner approval policy:
    - For one-time, staging-only, metadata-read diagnostics, the project owner may approve a bounded run without a second human approver.
    - This does not change technical controls: one-use authorization, restricted creator/operator paths, 5-minute expiry, no retries, immediate launcher disablement, and full audit evidence remain mandatory.
    - This policy never authorizes production DB operations, snapshot activation, financial/ledger mutations, role creation, or privilege grants.
  - Proposed Identity Center permission set design for separate approval:
    - permission set name: `GenesisS2GDiagnosticAuthorizationCreator`
    - no managed policies
    - inline policy: `sts:AssumeRole` only to `arn:aws:iam::452630323448:role/genesis-staging-s2g-db-admin-authorization-writer-role`
    - assignment required to an explicitly approved USER/GROUP (not auto-selected).
- Operator assume-role trust hardening (staged rollout; separate approval required):
  - Launcher stack now supports trust-source parameterization for the operator role:
    - `OperatorPrincipalArn` (legacy trust source, currently deployed),
    - `OperatorAssumerPrincipalArn` (future restricted trust source, default empty for no-op rollout).
  - When `OperatorAssumerPrincipalArn` is supplied, operator-role trust pivots to that restricted source principal.
  - Guardrail: `OperatorAssumerPrincipalArn` must not reference `AWSReservedSSO_AdministratorAccess`.
  - Proposed restricted operator permission set (not yet provisioned):
    - name: `GenesisS2GDiagOperator`
    - allowed action: `sts:AssumeRole` only
    - allowed resource: `arn:aws:iam::452630323448:role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma`
    - no direct Lambda/ECS/IAM/DynamoDB/SecretsManager/RDS permissions.
  - Required staged sequence:
    1) create restricted permission set,
    2) assign to approved user,
    3) capture provisioned AWSReservedSSO role ARN,
    4) prepare launcher trust update with `OperatorAssumerPrincipalArn`,
    5) deploy trust update under separate approval while launcher remains `DISABLED`,
    6) verify restricted source can assume operator role and AdministratorAccess source no longer can.
- Before creating/executing any launcher stack change set, run preflight validation in mode-specific form:
  - create-preflight: `npm run preflight:create:s2g-db-admin-launcher`
  - update-preflight: `npm run preflight:update:s2g-db-admin-launcher -- --change-set-name <reviewed-change-set-arn>`
  - update-preflight accepted baseline stack states:
    - `CREATE_COMPLETE`
    - `UPDATE_COMPLETE`
    - `UPDATE_ROLLBACK_COMPLETE` only with explicit rollback review/acknowledgement (`--allow-rollback-complete`)
  - The validator fails closed if the Lambda asset object is missing from the CDK bootstrap bucket, if stack mode/identity is incorrect, if activation defaults drift from reviewed values, if protected ECS services are unhealthy, or if update-mode change-set scope contains unexpected action/replacement/resource changes.
- The default command is diagnostic-only (`node scripts/staging-s2g-db-admin-diagnostic.mjs`) and requires:
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
6. Confirm the synthesized launcher Lambda asset object exists in `cdk-hnb659fds-assets-<account>-<region>` before executing a CloudFormation change set.

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
