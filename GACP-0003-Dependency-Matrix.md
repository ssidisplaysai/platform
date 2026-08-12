# GACP-0003 - Before and After Dependency Matrix

## Baseline Source
- `genesis/audits/GAR-0002/evidence/dependency-direction-analysis.json` captured before GACP-0003 final regeneration.

## Protected Layout Seam Edge Transition

| From | Baseline To | Final To | Transition |
|---|---|---|---|
| src/app/glw/(protected)/layout.tsx | src/lib/glw/auth.ts | src/lib/glw/auth.ts | Retained |
| src/app/glw/(protected)/layout.tsx | src/platform/gop/auth/runtime.ts | src/platform/gop/auth/runtime.ts | Retained |
| src/app/glw/(protected)/layout.tsx | src/platform/gop/runtime/loader.ts | - | Removed |
| src/app/glw/(protected)/layout.tsx | src/platform/gop/workspaces/runtime.ts | - | Removed |
| src/app/glw/(protected)/layout.tsx | - | src/lib/gop/platform-bootstrap-api.ts | Added |

## Aggregate Metrics
- Baseline total `application-to-implementation`: 105
- Final total `application-to-implementation`: 104
- Net change: -1
- Baseline layout seam edges: 4
- Final layout seam edges: 3
- Layout seam net change: -1

## Violations
- Baseline GAR dependency-direction violations: 0
- Final GAR dependency-direction violations: 0
- New violations introduced: 0
