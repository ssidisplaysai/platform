# Genesis Production Job Architecture

## Position In Foundation
The Production Job aggregate extends the manufacturing document chain as the execution-authorizing unit downstream of Work Order release.

## Layers
- Domain contract: `production-job-types.ts`.
- Domain logic and persistence: `production-job-repository.ts`.
- Validation and selectors: `production-job-validation.ts`, `production-job-selectors.ts`.
- API surface: `src/app/api/production-jobs/**`.
- UI projection: `src/modules/foundation/ProductionJob*.tsx` and `src/app/production-jobs/**`.
- Platform controls: `types.ts`, `api-auth.ts`, `permissions.ts`, `navigation.ts`.

## Architectural Properties
- Optimistic concurrency via expected version checks.
- Rollback-safe mutation wrapper for repository writes.
- Immutable lineage object anchoring source documents and correlation/causation metadata.
- Event + audit capture for lifecycle and revision actions.
- Search index exposure through foundation navigation registry.

## Boundary Enforcement
Architecture only authorizes and tracks production job lifecycle state. It does not execute machine control, scheduling, inventory, quality, or MES integrations.
