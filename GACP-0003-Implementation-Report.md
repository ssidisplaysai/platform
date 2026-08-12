# GACP-0003 - Implementation Report

Status: Complete
Date: 2026-07-29
Disposition: APPROVED

## Scope Statement
GACP-0003 implements the certified Platform Bootstrap API seam by moving protected layout bootstrap coordination behind a public API surface while preserving application-layer authorization and runtime authority boundaries.

## Files Changed (Implementation)
- src/lib/gop/platform-bootstrap-api.ts
- src/app/glw/(protected)/layout.tsx
- src/platform/gop/auth/runtime.ts
- tests/gop/platform-bootstrap-api.test.ts

## Implementation Details
1. Public bootstrap API introduced
- Added `initializePlatform` and supporting functions in `src/lib/gop/platform-bootstrap-api.ts`.
- API returns workspace, navigation, capabilities, and bootstrap state contract.

2. Protected layout rewired
- `src/app/glw/(protected)/layout.tsx` now calls `initializePlatform({ subject })`.
- Removed direct layout coordination with runtime loader and workspace runtime internals.

3. Authorization helper consolidation
- Added `isSubjectAuthorizedForRoute` to `src/platform/gop/auth/runtime.ts`.
- Layout keeps auth decision responsibility without importing resolver internals directly.

4. Focused contract tests
- Added `tests/gop/platform-bootstrap-api.test.ts` validating authorized bootstrap, no-workspace behavior, and capability derivation.

## Behavior Preservation Argument
- Protected route session gate and redirect behavior remains unchanged.
- Route authorization still occurs in the layout before shell render.
- Navigation and workspace selection remain derived from existing GOP runtime data sources.

## Dependency Debt Result
- Baseline total `application-to-implementation`: 105
- Final total `application-to-implementation`: 104
- Net reduction: -1
- Baseline protected layout seam edges: 4
- Final protected layout seam edges: 3
- Removed layout edges:
  - `src/platform/gop/runtime/loader.ts`
  - `src/platform/gop/workspaces/runtime.ts`
- Added layout edge:
  - `src/lib/gop/platform-bootstrap-api.ts`
- No new GAR dependency-direction violations introduced (`violations: 0` before and after).

## Runtime Authority Statement
- No runtime authority transfer occurred.
- Existing runtime implementations remain authoritative and are consumed through the new public bootstrap API surface.

## Completion Checklist
- [x] Introduce public Platform Bootstrap API surface.
- [x] Rewire protected layout bootstrap coordination to public API.
- [x] Preserve layout authorization ownership.
- [x] Validate changed files for diagnostics.
- [x] Execute focused GOP tests.
- [x] Execute GOP regression suite.
- [x] Execute focused lint.
- [x] Regenerate GAR-0001 and GAR-0002 evidence.
- [x] Validate GAR-0002 evidence schema.
- [x] Capture before/after dependency-direction metrics and seam-edge deltas.
