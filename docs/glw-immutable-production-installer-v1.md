# GLW Immutable Production Installer V1

## Authority

This installer implements the transaction recovered from:

- `Genesis-Platform-1.1.1-HR-004-GLW-Protected-Launcher-Replacement-Mechanism-Authority-Evidence.json`
- `Genesis-Platform-1.1.1-HR-004-GLW-DACL-Preserving-Launcher-Replacement-Execution-Evidence.json`
- `Genesis-Platform-1.1.1-HR-004-GLW-Runtime-Switch-To-Certified-Hierarchy-Release-Evidence.json`

It consumes a stage produced by `glw-immutable-release.mjs prepare`. It does not build source.

## Command

Run only from a high-integrity Administrator PowerShell after separate owner authorization:

```powershell
node scripts/glw-immutable-release.mjs install `
  --stage <prepared-stage> `
  --repository <git-repository> `
  --persistence-root <durable-gcp-foundation-data> `
  --typecheck-baseline <certified-baseline-if-plan-requires-one>
```

ProgramData environment, launcher, release, manifest, rollback, and evidence paths default to the canonical Genesis GLW authorities. They may be supplied explicitly for isolated certification fixtures.

## Transaction

Before mutation the installer requires:

1. Elevated Administrator authority.
2. Exact release-plan schema, source commit/tree, stage paths, hashes, and prepared-only mutation marker.
3. Complete manifest verification of every staged object, type, length, and SHA-256; links and reparse points are rejected.
4. Exact candidate launcher release, manifest, source, tree, build, environment, and runtime identity assignments.
5. A healthy Task Scheduler/protected-launcher-owned production runtime on port 3001.
6. A healthy unchanged sidecar on port 3002.
7. Promotion not enabled, zero ownership collisions, zero unreconciled records, and a complete persistence snapshot.

The certified predecessor release `6904b4a382a54a78efb742b2863e564946a587fe` / `j0SCH6qGgHFA8AIWhd4d3` predates the Campaign Launchpad route. A no-redirect HTTP 404 is represented as `LEGACY_ROUTE_ABSENT_SAFE` only for that exact SHA, build, immutable release path, and Task Scheduler-owned process ancestry during pre-install inspection. Every other 404 fails closed.

After installation, `/api/glw/campaign-launch` must exist, return valid JSON with `mutationPerformed=false`, and report a state other than `ENABLED_CERTIFIED_RELEASE`. Authentication failures, redirects, malformed JSON, missing authority fields, and 5xx responses fail closed. The sidecar check is the existing read-only UI route `/glw/campaigns`; it must return HTTP 200 without redirect. `/api/glw/campaigns` is not used as an unauthenticated health probe.

The mutation order is:

1. Copy the exact staged release to its plan-derived final path and verify it completely.
2. Copy and hash-verify the manifest.
3. Capture prior launcher bytes, hash, owner, SDDL, and protected DACL.
4. Persist an exact rollback copy.
5. Add one temporary `BUILTIN\Administrators` `Write` rule.
6. Replace launcher bytes in place.
7. Restore the exact original owner/SDDL in `finally`; require zero remaining write rules.
8. Stop the single protected launcher process tree once.
9. Invoke the protected launcher once.
10. Require exact SHA/build/release identity, `HEALTHY/READY/LIVE`, required capabilities, unchanged sidecar, unchanged persistence hashes/counts, and promotion disabled.
11. Write secret-free durable evidence.

## Rollback

Before runtime stop, any failure restores the prior launcher bytes and exact security state and removes partially installed release/manifest artifacts.

After runtime stop, rollback additionally starts the restored protected launcher once and verifies the prior SHA/build before removing new artifacts. Rollback failure is reported explicitly and never suppressed.

## Idempotency

`ALREADY_INSTALLED_AND_RUNNING` is returned only when runtime SHA/build/path, final release tree, installed manifest hash, launcher hash, and protected launcher security all match exactly. Conflicting partial or unrelated artifacts fail closed without recycling production.

## Safety

The installer never sets campaign promotion variables and rejects an enabled promotion state before and after installation. It issues no WordPress or campaign mutation requests. Installation evidence contains hashes, counts, runtime identities, ACL fingerprints, and rollback state, but no environment values or secrets.
