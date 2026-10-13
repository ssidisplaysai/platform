# Share-to-Grow Secure Snapshot Export Runbook (Staging)

## Scope and non-goals

- Scope: staged, read-only export of Share-to-Grow repository snapshots for deterministic dry-run reconciliation.
- Non-goals: no production export, no migration apply, no runtime cutover, no financial mutation.

## Required operator identity

- Use a non-root operator principal approved to assume `StagingSnapshotOperatorRole`.
- Root credentials are forbidden for export execution.

## Required roles

- `StagingSnapshotOperatorRole`
  - Launches only approved staging one-off export task definitions.
  - May pass only approved staging execution/task roles.
- `StagingSnapshotExporterRole`
  - Reads staging sources and uploads encrypted artifacts.
- `StagingSnapshotReaderRole`
  - Reads run-scoped encrypted artifacts and decrypts them locally.

## Deployment approval gate (before any apply)

1. Security review approved for S3/KMS and retention controls.
2. IAM least-privilege review approved.
3. Staging-only stack diff reviewed.
4. Explicit sign-off that no production stack updates are included.

## Snapshot acquisition and encrypted export

1. Assume `StagingSnapshotOperatorRole`.
2. Verify target account and region.
3. Register/launch one-off `genesis-staging-snapshot-export` task.
4. Confirm task is in staging cluster/subnets/security group only.
5. Read CloudWatch logs and verify only metadata appears:
   - runId
   - namespace
   - revision/schemaVersion/updatedAt
   - raw/canonical SHA256 hashes
   - collection counts
6. Confirm snapshot objects written only under:
   - `exports/<reconciliation-run-id>/postgres.snapshot.json`
   - `exports/<reconciliation-run-id>/filesystem.snapshot.json`

## Secure download and local handling

1. Assume `StagingSnapshotReaderRole` with `reconciliation-run-id` principal tag.
2. Download objects into a protected local directory outside the repository.
3. Verify local SHA256 hashes against exporter metadata.
4. Do not upload raw snapshots to GitHub, CI artifacts, or chat outputs.

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
- Enforce TLS and SSE-KMS for all snapshot artifact writes.
- Keep artifacts under short retention lifecycle.
- Track execution events in CloudTrail management events and S3 data-event plan.

## Artifact expiration and cleanup

- Bucket lifecycle expiration applies to `exports/` prefix.
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

