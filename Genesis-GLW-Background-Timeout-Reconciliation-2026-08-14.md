# Genesis GLW Background Timeout Reconciliation Certification

Date: 2026-08-14

## Baseline
- Branch: work/glw-background-timeout-reconciliation
- Certified parent: c94f877ec201999942b257b55f8c2b6d5420b8cf
- Protected baseline tag: glw-production-baseline-2026-08-13
- Protected baseline tag commit: 5468037337df1859acf4a7da430f00442addf7ae

## Implemented Architecture

### Timeout policy source
- Canonical timeout policy remains in src/lib/glw/jobs.ts:
  - GLW_JOB_TIMEOUT_MS
  - isGlwJobTimedOut
  - terminal and transition invariants

### Canonical reconciliation service
- Added src/lib/glw/timeout-reconciliation.ts with:
  - reconcileGlwTimedOutJob (single-job reconciliation)
  - reconcileGlwTimedOutJobs (batch reconciliation)
  - runGlwTimeoutReconciliation (proactive bounded reconciliation with counters)

### Bounded candidate scanning
- Added repository status-filtered scan method:
  - findPageGenerationJobsByStatuses(statuses, limit)
- Proactive run clamps limit to bounded range and scans non-terminal statuses only.

### Structured counters and observability
- Proactive reconciliation reports:
  - startedAt, completedAt
  - scanned, eligible, reconciled
  - skipped, alreadyTerminal, errors
  - per-item action results

### Conditional repository mutation (race-safe)
- Added repository conditional mutation method:
  - updateIfCurrentStatusIn(id, statuses, changes)
- This prevents stale reconciler overwrites after competing terminal updates.

### Repository implementations
- Prisma implementation updated in src/lib/glw/job-repository.ts:
  - updateIfCurrentStatusIn
  - findPageGenerationJobsByStatuses
- In-memory implementation updated in src/lib/glw/job-repository.ts:
  - updateIfCurrentStatusIn
  - findPageGenerationJobsByStatuses

### Shared non-terminal status definitions
- Added glwNonTerminalJobStatuses in src/lib/glw/jobs.ts.

### Read-path reuse of canonical reconciliation
- src/lib/glw/page-generation-api.ts now reuses canonical service for:
  - handleGetJob
  - handleRetryJob
  - listPageGenerationJobs
  - getPageGenerationDashboard

### Proactive internal route
- Added handler in src/lib/glw/page-generation-api.ts:
  - handleRunTimeoutReconciliation
- Added route endpoint:
  - src/app/api/glw/jobs/reconcile-timeouts/route.ts

## Security Model
- Proactive reconciliation route is not anonymously writable.
- Signed GOP worker-token verification is required.
- WorkerId policy is enforced for reconciliation worker identity.
- Invalid token: 401.
- Invalid workerId: 403.
- GLW n8n callback credential is not repurposed for maintenance authentication.
- No plaintext maintenance secret added to source.

## Race Semantics and Canonical Behavior

1. Fresh STARTING job:
- Protected; remains non-terminal (no timeout reconciliation mutation).

2. Fresh RUNNING job:
- Protected; remains non-terminal (no timeout reconciliation mutation).

3. Stale STARTING job:
- Reconciled to terminal FAILED with canonical timeout error.

4. Stale RUNNING job:
- Reconciled to terminal FAILED with canonical timeout error.

5. Already COMPLETE job:
- Not reconciled; terminal invariant preserved.

6. Already FAILED and FAILED_QA terminal jobs:
- Not regressed by reconciliation; terminal invariant preserved.

7. Repeated reconciliation:
- Idempotent; second run does not re-mutate reconciled terminal jobs.

8. Overlapping reconciliation:
- Conditional update prevents stale overwrite when status changes before write.

9. Completion callback vs reconciliation:
- Terminal invariants preserved by transition guards and conditional reconciliation behavior.

10. Failure callback vs reconciliation:
- Terminal invariants preserved; no regression from terminal failure state.

11. Late callback after timeout:
- Canonical transition guard behavior applies; terminal regressions are rejected.

12. Retry and dispatch eligibility after reconciliation:
- Reconciled FAILED jobs become retry-eligible through existing retry guard rules.
- In-progress retry guard remains enforced.

## Callback Interaction
- Existing callback alias normalization and QA field preservation remain intact.
- Callback executionId correlation and transition validation remain intact.

## Test Isolation Recovery (409 triage)
- Classification: test state contamination.
- Cause: ambient DATABASE_URL in shell enabled optional event-store path during in-memory callback test.
- Symptom: PostgreSQL auth error surfaced through callback conflict mapping (HTTP 409).
- Resolution:
  - clear DATABASE_URL at test boundary in tests/glw/page-generation-api.test.ts before each test.
  - preserve callback semantics and assertions.

## Validation Results

Timeout and API suites:
- PASS
- 2/2 suites
- 42/42 tests

Focused GLW validation suites:
- PASS
- 5/5 suites
- 49/49 tests

TypeScript:
- PASS (npx tsc --noEmit)

Build:
- PASS (npm run build)

Security and safety:
- Signed trigger auth: PASS
- Fresh jobs protected: PASS
- Stale jobs reconciled: PASS
- Idempotency: PASS
- Race safety: PASS

Production safety:
- Production jobs dispatched: NO
- WordPress mutation: NO
- n8n modified: NO
- Cloudflare modified: NO

## Deployment Distinction

A. Reconciliation capability:
- Certified. Secure proactive reconciliation endpoint and canonical service are implemented and validated.

B. Scheduler activation:
- Deferred operational activation item.
- No production recurring scheduler activation is claimed in this certification.
- No Cloudflare or n8n scheduler activation was performed in this workstream.
