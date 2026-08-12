# GACP-0004 Remaining Technical Debt

Date: 2026-07-28
Package: GACP-0004

## 1. Debt Cleared by This Package
- Removed direct runtime capability constructor usage from implementation callsites in scope.
- Converged capability construction to authoritative construction surfaces.
- Reduced per-request runtime dependency reconstruction in GEA API handlers.

## 2. Remaining Debt (Out of Scope or Deferred)
1. Broader non-capability registry convergence families identified in GACI-0003 remain for future packages.
2. Repository-global TypeScript template placeholder errors in tools/genesis/templates remain unresolved and are outside this package.
3. Full registry convergence (beyond capability authority path) is deferred to future certified slices under GACP-0004 continuation and subsequent packages.

## 3. Suggested Next Debt Slice
- Continue convergence of runtime registry consumers that still construct adjacent runtime registries independently where constitutional authority permits.
- Keep all changes constrained to certified authority model boundaries.

## 4. Disposition
No blocker debt introduced by GACP-0004.
Pre-existing repository debt remains tracked outside this package scope.
