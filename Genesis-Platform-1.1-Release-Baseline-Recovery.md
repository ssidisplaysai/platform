# Genesis Platform 1.1 Release Baseline Recovery

## Executive summary

This recovery pass establishes a safe, evidence-based status for Platform 1.1:

- Historical Platform 1.1 certification status: PASS
- Historical Git provenance was not captured; therefore the historical SHA is not proven.
- The current source does contain the pass-producing implementation for the known Prisma transaction harness repair.
- The repository environment is valid and Prisma schema validation passes.
- The current implementation is NOT release-green because the required focused BGE suite and production build currently fail.
- Therefore no reproducible release candidate can be certified from the current branch state.

## Step 1 — Verify PASS-producing source

### Target check: tests/bge/bge-prisma-repository.test.ts

Evidence reviewed from current source:

- The fake transaction object includes `$executeRawUnsafe: async () => 0`.
- The repository test harness calls `$transaction(async (transaction) => ... )` and passes the fake Prisma client into the production repository path.
- The production repository at `src/lib/bge/prisma-repository.ts` calls `await transaction.$executeRawUnsafe('SET CONSTRAINTS ... DEFERRED')` inside `withTransaction`.

### Required surface check

| Item | Status |
| --- | --- |
| Fake Prisma transaction object includes `$executeRawUnsafe` | PRESENT |
| Production repository uses `$executeRawUnsafe` in transaction flow | PRESENT |
| BGE repository persistence implementation | PRESENT |
| Object/version lifecycle repair | PRESENT |
| Canonical runtime composition | PRESENT |
| GOP event authority integration | PRESENT |
| GED evidence lifecycle integration | PRESENT |
| GMP knowledge delegation | PRESENT |
| GOP Mission Control projection integration | PRESENT |

The current implementation reflects the previously certified BGE persistence path; however, the required release certification remains blocked by current test/build failures in the active source, not by an absence of the historical fix.

## Step 2 — Diagnose DATABASE_URL precisely

### Findings

- `.env` is structurally valid for the project’s expected Variables.
- The raw value format is a standard PostgreSQL DSN with a password containing a punctuation character `!` but no malformed quoting or hidden CR/LF corruption in the current file.
- The repository does not use a `dotenv/config` import in the runtime path; instead, the normal environment-loading mechanism is the custom PowerShell loader embedded in [scripts/deploy-glw.ps1](scripts/deploy-glw.ps1) and [scripts/operations/deploy-glw.ps1](scripts/operations/deploy-glw.ps1), which trims surrounding quotes and then writes values to `Env:`.
- The database string was successfully loaded into the current PowerShell process and Prisma accepted it for validation and schema checks.

### Root cause

The issue is not a broken `.env` file. The precise issue in this recovery pass was a manual environment-loading path that was not consistently trusted for the local runtime work. The actual repository environment is valid, and Prisma validates correctly once the value is loaded into the process environment in the repository’s normal manner.

### Summary

- ROOT_CAUSE: untrusted manual PowerShell assignment and inconsistent local environment import, not a malformed `.env` file.
- ENV_FILE_VALID = YES
- POWERSHELL_IMPORT_VALID = YES

## Step 3 — Verify database without modifying it

Executed in the current environment after loading `.env` into the process environment:

- `npx prisma --version` -> PASS
- `npx prisma validate` -> PASS
- `npx prisma migrate status` -> PASS

Prisma version:

- 7.9.0

Schema validation:

- The schema at `prisma/schema.prisma` is valid.

Migration status:

- 32 migrations found in `prisma/migrations`
- Database schema is up to date.
- Pending migration count: 0

## Step 4 — Recover runtime commands

### Canonical 3001 command

Verified from repository script evidence in [scripts/deploy-glw.ps1](scripts/deploy-glw.ps1):

`node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3001`

### Canonical 3002 command

Not proven from repo-tracked scripts. The repository evidence does not contain a canonical committed start command for port 3002.

The historical live restart proof is associated with the actual Cloudflare ingress mapping, which points to port 3002 for `glw-dev.ssiai.app`.

## Step 5 — Recover Cloudflare routing

The active `cloudflared` process and config were inspected without altering the runtime.

Observed ingress configuration:

- `glw-dev.ssiai.app` -> `http://localhost:3002`
- `app.ssiai.app` -> `http://localhost:3001`
- fallback: `http_status:404`

This is the active routing in the current local config, and it is the best evidence for the runtime mapping in this environment.

## Step 6 — Verify current implementation

Mandatory verification command executed:

`npm test -- bge-convergence.test.ts bge-api.test.ts bge-prisma-repository.test.ts bge-repository-composition.test.ts --runInBand`

Result:

- 4 total suites
- 3 passed
- 1 failed
- 7 total tests
- 3 passed
- 4 failed

The failure mode is not a Prisma transaction-initialization issue. The active source breaks at the GMP integration boundary, where the code imports `normalizeBusinessGenomePayload` and `deriveBgeConfidenceFromEvidenceSignals` from `src/lib/gmp/evidence-services.ts`, but those exports are absent in the current source.

Mandatory build command executed:

`npm run build`

Result:

- FAIL
- Error: export not found in `src/lib/gmp/evidence-services.ts`

This blocks the release path.

## Step 7 — Analyze the sanitation stash

Inspection of `stash@{0}` shows it contains a broad cleanup checkpoint for temporary and forensic artifacts, including many `.tmp-*` files and audit-related artifacts.

### Classification

| Classification | Paths / groups |
| --- | --- |
| INCLUDE_IN_RELEASE | None at this stage; the release candidate cannot be created while the implementation is failing mandatory tests and build. |
| EXCLUDE_TEMPORARY | `.tmp-*` files, temporary forensic JSON/MD output, diff-classification artifacts, audit temp files, runtime probe artifacts |
| REQUIRES_REVIEW | The active release artifacts under `Genesis-Platform-1.1-*`, and any uncommitted source files that are not yet proven to be part of the green release candidate |

The important restriction is that no certification evidence is deleted; the `.tmp` forensic/debug artifacts are excluded from the release baseline, while the official Platform 1.1 certification documents remain preserved.

## Step 8 — Prepare release candidate plan

This step is deliberately blocked by current test/build failures.

The manifest is not safe because the source does not satisfy the required gates:

- 4/4 focused suites PASS -> currently FAIL
- 7/7 tests PASS -> currently FAIL
- build PASS -> currently FAIL
- migration status green -> current state is green, but certification requires the full implementation path to pass.
- no release candidate SHA can be created until the source is green.

### Files to add

- none, until the source is green and the release manifest is approved

### Files to modify

- none in this recovery pass; no release candidate is created while the tests/build remain red

### Files to delete

- no certified evidence files are deleted
- temporary `.tmp-*` artifacts are excluded from any future release baseline under a proper cleanup step, but not removed in this recovery pass

### Files intentionally excluded

- disposable `.tmp-*` forensic/debug artifacts
- unrelated feature work from the current branch
- secrets and private connection values

## Decision

The current repository is not release-green and therefore cannot support a new reproducible certified baseline from the current branch state.

Final status: FAIL (blocked before release candidate creation)

## Final note

The historical certification remains valid evidence, but it does not prove a Git SHA. The repository must be made green and re-verified before any candidate branch, commit, or tag can be created.
