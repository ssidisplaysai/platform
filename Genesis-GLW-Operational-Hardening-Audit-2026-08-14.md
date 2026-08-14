# Genesis GLW Operational Hardening Audit (2026-08-14)

## Baseline Reference
- Recovery branch: recovery/genesis-platform-1.1.1-bge
- Remote baseline branch: origin/recovery/genesis-platform-1.1.1-bge
- Baseline commit: 5468037337df1859acf4a7da430f00442addf7ae
- Baseline tag: glw-production-baseline-2026-08-13
- Certified recovery head at branch cut: 40f1dfb8232a30ff477fe2d4de6e74d7468f338b
- Working branch: work/glw-operational-hardening

## Scope
Focused operational hardening only.

No GLW content-generation behavior was changed.
No canonical site/workspace payload fields were changed.
No WordPress hierarchy, image settings, Cloudflare routing, or n8n workflow logic was changed.
No production jobs were dispatched.

## Health and Capability Findings
### Root cause
GLW runtime health was not evaluating live GLW runtime state.
The route [src/lib/glw/runtime-health-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/runtime-health-api.ts) previously read the in-memory enterprise health cache directly, and that cache is bootstrapped by [src/platform/ehc/runtime.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/platform/ehc/runtime.ts) through [src/platform/ehc/service.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/platform/ehc/service.ts) using registry simulation with one declared capability intentionally removed.

That simulation path explains the earlier observed mismatch:
- source = SIMULATED
- readiness could remain READY or NOT_READY based on deterministic seed logic
- liveness could remain LIVE
- page-generation could report UNAVAILABLE because simulation omits one declared capability
- status.state could report WARNING or DEGRADED even while the real GLW page-generation path worked

### Minimal correction
GLW health and capabilities now evaluate a GLW-specific runtime record on demand in [src/lib/glw/runtime-health-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/runtime-health-api.ts).

Semantics now used:
- LIVE: canonical GLW site registry is present
- READY: canonical site registry plus callback-path runtime configuration are present
- page-generation AVAILABLE: canonical site registry, GLW app callback base URL, n8n page webhook URL, and webhook secret are all present
- source: INTEGRATION

The capabilities route [src/app/api/glw/capabilities/route.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/app/api/glw/capabilities/route.ts) now returns the same evaluated record rather than the simulated cached advertisement.

### Observed before/after examples
Before, prior evidence showed:
- HTTP 200 from /api/glw/health
- record.source = SIMULATED
- record.status.state = WARNING
- record.status.readiness = READY
- record.status.liveness = LIVE
- page-generation availability = UNAVAILABLE

After, observed via regression execution in [tests/glw/runtime-health.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/runtime-health.test.ts):
- record.source = INTEGRATION
- record.status.state = HEALTHY when GLW runtime dependencies are configured
- record.status.readiness = READY
- record.status.liveness = LIVE
- page-generation availability = AVAILABLE

Also observed deterministically when callback-path configuration is incomplete:
- record.source = INTEGRATION
- record.status.state = WARNING
- record.status.readiness = NOT_READY
- record.status.liveness = LIVE
- page-generation availability = UNAVAILABLE

## Job Lifecycle Findings
### Root cause
GLW had timeout presentation logic in [src/lib/glw/jobs.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/jobs.ts) and stale-starting capacity logic in [src/lib/glw/publishing-plan-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/publishing-plan-api.ts), but the canonical persisted job record was not reconciled into a terminal failure state during normal reads.

That allowed jobs to remain persisted as STARTING or RUNNING indefinitely after callback loss or delayed terminal updates, while the UI only inferred a timeout locally from elapsed time. The result was stale 22 percent or 92 percent displays and retry ambiguity because the underlying job still looked active.

### Minimal correction
API read surfaces in [src/lib/glw/page-generation-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation-api.ts) now reconcile timed-out non-terminal jobs into a deterministic terminal FAILED record with:
- error.code = TIMED_OUT
- error.message = GLW job timed out while waiting for workflow completion callback.

This reconciliation now occurs when listing jobs, fetching a job, and checking retry eligibility.

### Canonical source of truth
The canonical source of truth remains the persisted GLW job record in the GLW repository.

### Writers identified
Job status/progress writers identified in scope:
- submission path in [src/lib/glw/page-generation.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation.ts)
- callback path in [src/lib/glw/page-generation.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation.ts)
- timeout reconciliation on read in [src/lib/glw/page-generation-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation-api.ts)

### Determinism outcomes
- Terminal states cannot regress because [src/lib/glw/jobs.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/jobs.ts) already blocks transitions away from COMPLETE, FAILED_QA, and FAILED.
- Duplicate callbacks remain idempotent because identical terminal callback payloads return the existing record unchanged.
- Wrong execution correlation is rejected before any update.
- Retry remains blocked for active retries and is enabled only after deterministic terminal failure.

## Callback Integrity Findings
### Findings
GLW callback auth expects a static environment-backed Bearer token via GLW_N8N_WEBHOOK_SECRET in [src/lib/glw/page-generation-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation-api.ts) and [src/lib/glw/n8n.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/n8n.ts).

Observed callback contract properties:
- auth contract is environment-backed static Bearer validation
- callback replay is safe for identical payloads because callback application is idempotent
- duplicate callbacks do not create duplicate terminal transitions for identical payloads
- callback target mismatch cannot update the wrong job if executionId does not match the tracked externalExecutionId
- jobId plus Bearer auth alone is not the full safety boundary; jobId plus auth plus executionId correlation is the effective boundary

### Decision
No n8n credential change was made in this audit.
The current GLW-side contract is no longer ambiguous enough to require a production n8n change during this hardening pass.

## UI Synchronization Findings
### Root cause
The UI already rendered directly from persisted job status through [src/components/glw/glw-page-generation-workspace.tsx](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/components/glw/glw-page-generation-workspace.tsx) and [src/components/glw/glw-job-panel.tsx](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/components/glw/glw-job-panel.tsx). The main synchronization defect was upstream: stale persisted non-terminal jobs were still being served to the UI.

### Effect of correction
Once the API reconciles stale in-progress jobs to terminal FAILED, the existing polling and detail rendering surfaces show terminal status rather than preserving stale STARTING/RUNNING displays indefinitely.

## Files Changed
- [src/app/api/glw/capabilities/route.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/app/api/glw/capabilities/route.ts)
- [src/lib/glw/jobs.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/jobs.ts)
- [src/lib/glw/page-generation-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/page-generation-api.ts)
- [src/lib/glw/runtime-health-api.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/src/lib/glw/runtime-health-api.ts)
- [tests/glw/job-operator-snapshot.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/job-operator-snapshot.test.ts)
- [tests/glw/page-generation-api.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/page-generation-api.test.ts)
- [tests/glw/runtime-health.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/runtime-health.test.ts)

## Tests Added or Updated
Added:
- [tests/glw/runtime-health.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/runtime-health.test.ts)
- [tests/glw/job-operator-snapshot.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/job-operator-snapshot.test.ts)

Updated:
- [tests/glw/page-generation-api.test.ts](c:/Users/rober/Documents/Stoner%20Platform/platform-glw/tests/glw/page-generation-api.test.ts)

Coverage added in scope:
- health endpoint truthfulness
- page-generation capability evaluation
- failure callback success
- duplicate callback idempotency
- invalid auth callback rejection
- incorrect job correlation rejection
- terminal state cannot regress
- UI job status rendering after terminal callback
- stale progress/status reconciliation

Existing coverage retained:
- canonical payload contract
- completion callback success
- generate page UI behavior

## Validation Results
Focused tests executed:
- npm test -- tests/glw/generate-page-ui.test.tsx tests/glw/page-generation-api.test.ts tests/glw/runtime-health.test.ts tests/glw/job-operator-snapshot.test.ts
- Result: PASS (4 suites, 40 tests)

TypeScript:
- npx tsc --noEmit
- Result: PASS

Build:
- npm run build
- Result: PASS

## Repository Safety
- Starting branch head: 40f1dfb8232a30ff477fe2d4de6e74d7468f338b
- Baseline tag remained unchanged: glw-production-baseline-2026-08-13 -> 5468037337df1859acf4a7da430f00442addf7ae
- Preserved stashes remained intact
- Unexpected unrelated evidence files encountered during the audit were preserved in named stashes and not restored

Additional preservation stashes created during this audit:
- operational-hardening-preserve-unexpected-2026-08-14
- operational-hardening-preserve-unexpected-round2-2026-08-14

## Deferred Risks
- The enterprise health subsystem still boots from simulation for general applications; this audit corrected GLW truth at the GLW boundary rather than redesigning global EHC bootstrap behavior.
- Timeout reconciliation is read-triggered, not background-scheduled. That is sufficient for deterministic operator visibility and retry safety, but not a substitute for a dedicated job sweeper if broader platform semantics later require one.
- n8n callback header management on the workflow side was not changed automatically. GLW-side auth expectations are clear, but any n8n credential migration should still be handled as an explicit production change.

## n8n Change Recommendation
n8n production workflow modification is not required for this GLW hardening patch.
If the checked-in workflow artifacts still contain hardcoded Authorization values, a separate credential hygiene task is still recommended with explicit production approval.

## Production Smoke Recommendation
A deterministic local smoke harness is still recommended if you want one-command verification of:
submit job -> mock acceptance -> callback -> persisted terminal COMPLETE
This audit did not add that harness because the current focused regression coverage closed the targeted defects without introducing a larger test framework.
