# GACI-0002A-R1 - Protected Layout Seam Assessment

Status: Complete
Date: 2026-07-28
Mode: READ-ONLY ARCHITECTURAL ASSESSMENT
Program: Genesis Stabilization Program
Parent Package: GACP-0002A

## 1. Executive Summary
This assessment classifies the protected layout seam in src/app/glw/(protected)/layout.tsx.

Result: MIXED RESPONSIBILITY.

The seam currently combines two categories of behavior:
1. Boundary protection behavior (session gate and workspace access gate), which aligns with protected authorization seam intent.
2. Runtime/platform bootstrap behavior (module navigation loading and workspace runtime selection), which is deeper implementation coordination.

Because those responsibilities are currently coupled in one application layout entrypoint, the seam is not purely an authorization exception and is not purely debt. It is mixed.

## 2. Current Dependency
Protected layout imports:
- next/navigation redirect
- src/components/glw/glw-shell.tsx
- src/lib/glw/auth.ts
- src/platform/gop/auth/runtime.ts
- src/platform/gop/runtime/loader.ts
- src/platform/gop/workspaces/runtime.ts

Authoritative GAR-0002 regenerated evidence classifies 4 edges from this layout as application-to-implementation:
- src/app/glw/(protected)/layout.tsx -> src/lib/glw/auth.ts
- src/app/glw/(protected)/layout.tsx -> src/platform/gop/auth/runtime.ts
- src/app/glw/(protected)/layout.tsx -> src/platform/gop/runtime/loader.ts
- src/app/glw/(protected)/layout.tsx -> src/platform/gop/workspaces/runtime.ts

## 3. Architectural Responsibilities
Observed responsibilities in layout:
- Authentication/session validation: getGlwSession and login redirect.
- Identity propagation: buildGenesisSubjectFromSession.
- Authorization boundary check: resolveAuthorizedWorkspaces and deny when zero.
- Workspace initialization: select authorized workspace or registry fallback.
- Runtime/module bootstrap for UI shell: getGenesisNavigationItems with subject and workspace.
- UI composition: render GlwShell with navigation and workspace.

Interpretation:
- Boundary enforcement concerns are legitimate seam responsibilities.
- Runtime bootstrap and module navigation coordination are platform orchestration concerns.

## 4. Dependency Direction Analysis
GAR-0002 regenerated count for application-to-implementation edges: 105.
Protected layout contributes 4 of those edges.

Direction class for those 4 edges: application-to-implementation with boundaryConcern=true.

Therefore, by default policy, these are prohibited unless covered by constitutional exception authority.

## 5. Authority Analysis
GACD-0001 certifies one authoritative runtime for production execution:
- src/platform/gop/runtime/orchestration-runtime.ts

The protected layout does not directly invoke orchestration-runtime execution lifecycle functions. It does not queue, dispatch, lease, retry, or replay jobs. Therefore, the seam does not supersede runtime authority.

However, the layout does invoke platform runtime module loading behavior through runtime/loader and workspace runtime selection, which places platform orchestration coordination directly in application UI.

## 6. Constitutional Policy Evaluation
GACD-0002 policy states:
- Application to platform/runtime internals is prohibited unless certified as exception.
- Protected authorization seams can be constitutional exceptions.

Evaluation of each layout import:
- src/lib/glw/auth.ts: supports protected boundary/session validation and can be justified as authorization seam support.
- src/platform/gop/auth/runtime.ts: subject construction and auth resolver access can be justified as authorization seam support.
- src/platform/gop/runtime/loader.ts: runtime module bootstrap/navigation assembly is implementation coordination, not strictly boundary enforcement.
- src/platform/gop/workspaces/runtime.ts: workspace runtime resolution/registry access combines authorization filtering with platform initialization.

Conclusion against policy: the seam partially satisfies constitutional exception policy but includes non-boundary runtime coordination responsibility.

## 7. Alternative Public API Assessment
Inspection result:
- Existing public export surface in src/platform/gop/index.ts does not expose an application-facing shell context API for protected layout composition.
- Existing src/lib/gop APIs are route/operation-focused and do not provide a consolidated protected-shell bootstrap contract.

Assessment:
- Equivalent behavior is not currently available through a dedicated public platform API for protected layout shell initialization.
- Current layout reaches into implementation modules to assemble boundary and bootstrap state.

## 8. Risk Assessment
Risk if left unchanged:
- Continued application-to-implementation coupling in a high-fan-in layout seam.
- Increased change amplification when auth/runtime bootstrap internals evolve.

Risk if changed without new boundary contract:
- Potential boundary regression by mixing auth and bootstrap movement without explicit API contract.
- Potential increase in complexity if responsibilities are moved piecemeal.

Runtime authority risk:
- Low direct risk to certified runtime authority as long as orchestration authority remains unchanged.

## 9. Classification
MIXED RESPONSIBILITY

Rationale:
- Approved seam behavior present: authentication and access gating.
- Implementation-coupled behavior present: runtime loader and workspace runtime bootstrap coordination.

## 10. Recommendation
REQUIRES NEW PUBLIC PLATFORM API

Reasoning:
- The seam should preserve boundary gating behavior.
- The bootstrap coordination behavior should be accessed through an explicit public contract rather than direct implementation imports.
- This recommendation provides separation guidance without implementation mutation in this package.

## 11. Evidence
Primary inspected files:
- src/app/glw/(protected)/layout.tsx
- src/lib/glw/auth.ts
- src/platform/gop/auth/runtime.ts
- src/platform/gop/runtime/loader.ts
- src/platform/gop/runtime/module-bootstrap.ts
- src/platform/gop/workspaces/runtime.ts
- src/platform/gop/workspaces/registry.ts
- src/platform/gop/index.ts
- src/components/glw/glw-shell.tsx

Authoritative governance and package references:
- GACD-0001-Runtime-Authority-Decision.md
- GACD-0002-Genesis-Dependency-Policy.md
- GACP-0002A-Implementation-Report.md
- GACP-0002A-Dependency-Matrix.md
- genesis/audits/GAR-0002/evidence/dependency-direction-analysis.json

Evidence facts captured:
- Regenerated GAR-0002 application-to-implementation count: 105.
- Layout-specific application-to-implementation edges: 4.
- No direct invocation of authoritative orchestration runtime execution control path from layout.

## 12. Traceability
- GACI-0002: Dependency direction baseline authority referenced through GAR-0002 evidence set used in GACP-0002A.
- GACD-0001: Runtime authority constraints applied to authority analysis.
- GACD-0002: Constitutional dependency policy and exception rules used for classification.
- GACP-0002A: Parent convergence package and residual seam context.

## Validation
- No implementation files modified: VERIFIED.
- No tests executed: VERIFIED (not required for read-only assessment).
- No runtime behavior changed: VERIFIED.
- No governance decisions altered: VERIFIED.
- No dependency metrics modified by this package document: VERIFIED.
