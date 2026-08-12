# GACP-0003 - Remaining Technical Debt

Status: Open
Date: 2026-07-29

## Residual Dependency Debt
- Final GAR `application-to-implementation` population remains 104.
- Remaining population is outside the narrow GACP-0003 seam objective and requires future controlled packages.

## Observed GAR Findings Context
- Current GAR architecture findings count: 4
  - Medium: 3
  - High: 1
- GACP-0003 did not increase finding count through dependency-direction violations.

## Known Global Validation Debt (Pre-Existing)
- Full repository TypeScript check remains blocked by template placeholder debt under `tools/genesis/templates/entity/*.template.ts`.
- This debt predates and is independent of GACP-0003 implementation.

## Suggested Next Controlled Slice Candidates
1. Continue reducing app-to-implementation population via route-level seam migrations to approved public surfaces.
2. Introduce explicit GAR classification support for approved public API seams when they are currently categorized as implementation.
3. Isolate and remediate template placeholder TypeScript debt in a dedicated non-architectural package.
