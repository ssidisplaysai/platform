# GACP-0002A - Before and After Dependency Matrix

## Baseline Source
- genesis/audits/GAR-0002/evidence/dependency-direction-analysis.json

## In-Scope Edges From Baseline

| From | Baseline To (Implementation Surface) | Classification | After State |
|---|---|---|---|
| src/app/glw/(protected)/operations/page.tsx | src/platform/gop/runtime/event-store.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/operations/page.tsx | src/platform/gop/runtime/orchestration-runtime.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/page.tsx | src/lib/glw/job-repository.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/page.tsx | src/lib/glw/jobs.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/pages/page.tsx | src/lib/glw/job-repository.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/queue/page.tsx | src/lib/glw/job-repository.ts | application-to-implementation | Removed |
| src/app/glw/(protected)/queue/page.tsx | src/lib/glw/jobs.ts | application-to-implementation | Removed |

## Aggregate
- Baseline in-scope edges: 7
- Post-change remaining edges in remediated files: 0
- Reduction: 7
- Baseline full application-to-implementation population: 112
- Regenerated full application-to-implementation population: 105
- New application-to-implementation violations introduced: 0

## Classification Counter Availability
- Intentional exceptions counter in `dependency-direction-analysis.json`: not modeled before or after (unchanged)
- False positives counter in `dependency-direction-analysis.json`: not modeled before or after (unchanged)

## Remaining Debt Outside This Slice
- src/app/glw/(protected)/layout.tsx imports runtime loader.
