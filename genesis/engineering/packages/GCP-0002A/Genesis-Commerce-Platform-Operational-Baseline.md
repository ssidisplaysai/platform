# Genesis Commerce Platform Operational Baseline

## Baseline Status
OPERATIONAL WITH CONDITIONS

## Verified Operational Components
1. Local development application startup via npm run dev
2. Dashboard and company workspace route rendering
3. Browser-level smoke checks with zero blocking script errors during validated route loads
4. PostgreSQL endpoint reachability on localhost:5432

## Conditional/Blocked Components
1. n8n local service unavailable on localhost:5678
2. WordPress publishing acceptance flow blocked by missing secret inputs
3. Full monorepo quality gates have pre-existing failures unrelated to this package recovery intent

## Baseline Evidence Anchors
- Source control baseline: branch feature/gap-0001-automation-registry at commit 7ac5afbbc95286f1f9733b61aac15ee8518a0cbb
- App startup evidence: next dev ready and HTTP 200 on localhost:3000
- PAT execution evidence: PAT-0001 report indicates NOT_EXECUTED with explicit secret blockers

## Application vs Platform Responsibility Check
### Preserved Genesis ownership
- runtime governance boundaries unchanged
- workflow infrastructure ownership unchanged
- Business Genome ownership unchanged
- Marketing Kernel ownership unchanged

### Preserved Commerce Platform ownership
- dashboard and UX validation performed in app routes
- application workflows and route surfaces validated without moving platform logic

## Root Cause Summary
1. Prior startup failures were not reproducible in this run once a clean npm run dev execution was kept active.
2. n8n validation is blocked because n8n service is not running locally.
3. WordPress validation is blocked by missing external credentials and API key secrets.
4. Repository-wide typecheck, lint, and test failures remain pre-existing broad baseline debt.

## Operational Baseline Decision
The local platform is suitable for continuing implementation planning and bounded development work that does not require live n8n and live WordPress publication until external dependency blockers are cleared.
