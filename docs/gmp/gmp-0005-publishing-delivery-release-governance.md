# GMP-0005: Publishing Packages, Delivery, and Release Governance

## Goal
GMP-0005 introduces governed publishing workflows that consume approved GMP-0004 artifacts and produce durable, auditable publication outcomes through package, release, and verification lifecycles.

## GMP-0005A Production Hardening Addendum
GMP-0005A completes production transport and operational safeguards without expanding GMP scope beyond publishing.

Delivered hardening updates:
- Concrete WordPress transport over `wp-json` with authenticated upsert and remote-state retrieval.
- Server-only destination credential provider with environment-backed references and cache invalidation hooks.
- Destination detail/update endpoints and destination capabilities/health APIs.
- Dependency-aware release validation and topological execution ordering safeguards.
- Publication retry and rollback operational handlers.
- Verification normalization metadata and reconciliation resolution state transitions.

## GMP-0005B Operator Completion Addendum
GMP-0005B completes operator-facing governance surfaces, operational observability, and freeze-ready validation for the publishing stream.

Delivered operator updates:
- Destination detail workspace with capability matrix, health summary, transport status, credential-cache invalidation, and read/write probes.
- Release detail workspace with dependency plan and release-progress views.
- Publication detail workspace with timeline, verification normalization detail, reconciliation actions, retry workflow, and rollback workflow.
- Package detail workspace with media delivery diagnostics.
- Project-level publication history surfaced in publishing workspace.
- Page-mode publishing workspace completion for package build and publication history views.

## GMP-0005C Final Authorization Closure Addendum
GMP-0005C closes certification conditions for explicit authorization proof, endpoint deny/allow evidence, UI control gating, and freeze disposition.

Delivered closure updates:
- Role/action authorization matrix tests across viewer, operator, admin, unauthorized, cross-workspace, and isolation boundaries.
- Endpoint-level tests for destination detail/health/capabilities/validate, publication retry/rollback/verify/reconcile/history, and release retry.
- UI control gating for destination mutation controls, release retry/approve controls, publication retry/rollback/reconciliation controls, package approval control, and force-overwrite visibility.
- Formal TypeScript debt register and scoped closure typecheck config.

## Architecture Summary
- Publishing never mutates approved draft or section artifacts.
- Approved source is assembled into `GmpApprovedRevisionSet` with deterministic `sourceFingerprint`.
- Destination-neutral `GmpPublishingPackage` + `GmpPublishingManifest` are built and validated before release inclusion.
- Releases orchestrate one or more package deliveries with append-only publication evidence and verification records.
- Idempotency keys prevent duplicate creates for equivalent operations.
- GOP execution metadata is captured on release execution and publication attempts.

## Domain Contracts
Implemented in:
- `src/lib/gmp/publishing-models.ts`
- `src/lib/gmp/publishing-contracts.ts`

Includes:
- Publishing package contract and schema versions.
- Manifest contract and machine-readable schema.
- Destination capability defaults.
- Release, release item, publication attempt/record/verification/reconciliation/idempotency contracts.

## Repository Architecture
Implemented in:
- `src/lib/gmp/publishing-repository.ts`

Provides:
- Prisma-backed repository for destinations, packages, manifests, validations, releases, release items, publication attempts, publication records, verification, reconciliation, and idempotency.
- In-memory repository for deterministic tests.

## Services
Implemented in:
- `src/lib/gmp/publishing-services.ts`

Capabilities:
- Publishing eligibility checks.
- Approved revision assembly with deterministic source fingerprint.
- Package + manifest builder.
- Package validation with capability-gap reporting.
- Destination validation and adapter resolution.
- Release creation, review-state transitions, validation, and execution.
- Publication attempt creation with failure classification and idempotency checks.
- Publication record creation and verification/reconciliation snapshots.

## Adapter Framework
Implemented in:
- `src/lib/gmp/publishing-adapters.ts`

Includes:
- Central adapter interface (`validateConnection`, `getCapabilities`, `validatePackage`, `preparePayload`, `publish`, `update`, `schedule`, `archive`, `delete`, `rollback`, `verify`, `fetchRemoteState`).
- Deterministic mock adapter for tests.
- WordPress adapter wrapper (`createWordpressDestinationAdapter`) behind the shared interface.

## Renderer and Payload Assembly
Implemented in:
- `src/lib/gmp/publishing-renderer.ts`

Includes:
- Versioned rendering metadata.
- Deterministic section ordering and output fingerprinting.
- Destination-safe sanitization baseline.

## API Surface
Implemented in:
- `src/lib/gmp/publishing-api.ts`
- `src/app/api/gmp/**` publishing route tree.

Highlights:
- Eligibility endpoint for drafts.
- Package CRUD/governance endpoints.
- Destination list/create/validate endpoints.
- Release list/create/item/validate/submit/approve/reject/execute endpoints.
- Publication list/detail/verify/reconcile endpoints.

GMP-0005B additions:
- `GET /api/gmp/publishing/destinations/[destinationId]`
- `PATCH /api/gmp/publishing/destinations/[destinationId]`
- `GET /api/gmp/publishing/destinations/[destinationId]/capabilities`
- `GET /api/gmp/publishing/destinations/[destinationId]/health`
- `POST /api/gmp/publishing/destinations/[destinationId]/test-read`
- `POST /api/gmp/publishing/destinations/[destinationId]/test-write`
- `POST /api/gmp/publishing/destinations/[destinationId]/credentials/invalidate`
- `GET /api/gmp/publishing/releases/[releaseId]/dependency-plan`
- `GET /api/gmp/publishing/releases/[releaseId]/progress`
- `POST /api/gmp/publishing/releases/[releaseId]/retry`
- `GET /api/gmp/publishing/publications/[publicationId]/history`
- `GET /api/gmp/projects/[id]/publishing/publications`
- `GET /api/gmp/publishing/publications/[publicationId]/reconcile`
- `POST /api/gmp/publishing/publications/[publicationId]/reconcile`

## Authorization
Publishing actions were added to GOP policy surfaces in:
- `src/platform/gop/auth/policies.ts`

Model:
- Default deny remains intact.
- Operators/managers/admins/developers/system can run publishing workflows.
- Viewers limited to publishing read actions.

Force-overwrite policy:
- `gmp:publishing:force_overwrite` requires elevated authorization and is denied for non-elevated roles by default-deny policy resolution.

Retry and rollback policy:
- Retry actions require `gmp:publishing:retry_publication`.
- Rollback execution requires `gmp:publishing:execute_rollback`.
- Reconciliation resolution requires `gmp:publishing:reconcile_publication`; force-republish branch requires `gmp:publishing:force_overwrite`.

Default-deny evidence:
- Unknown action checks return `DENIED_DEFAULT` in authorization matrix tests.

## Dashboard and UI
- Dashboard publishing metrics added in `src/lib/gmp/api.ts` and rendered in `src/components/gmp/gmp-project-dashboard.tsx`.
- Operator publishing workspace component created in `src/components/gmp/gmp-publishing-workspace.tsx`.
- Protected routes added under:
  - `/glw/projects/[id]/publishing`
  - `/glw/projects/[id]/publishing/destinations`
  - `/glw/projects/[id]/publishing/packages`
  - `/glw/projects/[id]/publishing/releases`
  - `/glw/projects/[id]/publishing/publications`
  - `/glw/projects/[id]/pages/[pageId]/publishing`

GMP-0005B protected detail surfaces:
- `/glw/projects/[id]/publishing/destinations/[destinationId]`
- `/glw/projects/[id]/publishing/releases/[releaseId]`
- `/glw/projects/[id]/publishing/publications/[publicationId]`
- `/glw/projects/[id]/publishing/packages/[packageId]`

## Database
Additive migration:
- `prisma/migrations/20260727021543_gmp_publishing_delivery_release_governance/migration.sql`

Schema additions include:
- `GmpPublishingDestination`
- `GmpDestinationCapability`
- `GmpApprovedRevisionSet`
- `GmpPublishingPackage`
- `GmpPublishingManifest`
- `GmpPublishingPackageValidation`
- `GmpMediaManifest`
- `GmpMediaManifestItem`
- `GmpRelease`
- `GmpReleaseItem`
- `GmpReleaseReview`
- `GmpReleaseApproval`
- `GmpPublicationAttempt`
- `GmpPublicationRecord`
- `GmpPublicationVerification`
- `GmpPublicationDifference`
- `GmpPublicationReconciliation`
- `GmpPublishingLineage`
- `GmpPublishingIdempotencyRecord`

## Validation Executed
- Focused publishing suites:
  - `npx jest tests/gmp/gmp-publishing-authorization-matrix.test.ts tests/gmp/gmp-publishing-services.test.ts tests/gmp/gmp-publishing-api.test.ts tests/gmp/gmp-publishing-ui.test.tsx tests/gmp/gmp-publishing-transport.test.ts`
  - Result: `5 passed, 5 total` suites; `28 passed, 28 total` tests.
- Focused open-handle diagnostic:
  - `npx jest tests/gmp/gmp-publishing-authorization-matrix.test.ts tests/gmp/gmp-publishing-services.test.ts tests/gmp/gmp-publishing-api.test.ts tests/gmp/gmp-publishing-ui.test.tsx tests/gmp/gmp-publishing-transport.test.ts --detectOpenHandles`
  - Result: `5 passed, 5 total` suites; `28 passed, 28 total` tests; no handle details emitted.
- Full GMP suite:
  - `npm test -- tests/gmp --runInBand`
  - Result: `15 passed, 15 total` suites; `60 passed, 60 total` tests.
- Full GOP suite:
  - `npm test -- tests/gop --runInBand`
  - Result: `15 passed, 15 total` suites; `43 passed, 43 total` tests.
- Open-handle comparison:
  - `npm test -- tests/gmp --runInBand --detectOpenHandles` (all pass, no actionable source)
  - `npm test -- tests/gmp --runInBand --forceExit` (all pass)
  - `npx jest tests/gmp --runInBand --testPathIgnorePatterns=gmp-publishing` (warning still reproducible)
  - `npx jest tests/gmp --runInBand --testPathIgnorePatterns=gmp-publishing --detectOpenHandles` (all pass, no actionable source)
- Focused lint:
  - `npx eslint src/lib/gmp src/components/gmp src/app/api/gmp "src/app/glw/(protected)/projects/[id]/publishing" tests/gmp`
  - Result: no errors; one pre-existing warning in `src/lib/gmp/page-graph-service.ts` for unused `groupBy`.
- TypeScript diagnostics:
  - `npx tsc --noEmit`
  - Result: fails in generator template files under `tools/genesis/templates/entity/*.template.ts` due placeholder tokens.
  - Scoped closure check: `npx tsc --noEmit --project tsconfig.gmp-0005c-closure.json` passes for GMP-0005C changed files.
- Prisma lifecycle:
  - `npx prisma validate` (schema valid)
  - `npx prisma migrate status` (database schema up to date)
  - `npx prisma generate` (client generation successful)

## Authorization Verification Status
Verified directly in tests:
- Session authentication reject path (`401`) for unauthenticated mutation requests.
- Viewer role cannot execute force-overwrite reconciliation (`403` on `force_republish` action).
- Non-elevated operator UI hides force-republish control and renders insufficient-permission state.
- Admin/elevated authorization can execute force-overwrite reconciliation path.
- Cross-workspace access is denied (`403`) and foreign-workspace resources are isolated (`404`).
- Unknown action is denied by default (`DENIED_DEFAULT`).

Verified by explicit matrix coverage:
- Destination management actions (patch/test/invalidate).
- Release retry action.
- Publication retry and rollback actions.
- Reconciliation accept/resolve and force-overwrite branch authorization.

## Known Limitations
- WordPress adapter transport is framework-ready but uses wrapper/mocked behavior in tests; production transport wiring should be finalized in deployment config.
- Dashboard and publishing workspace focus on governance operations and status visibility, with deeper release dependency graph visualizations deferred.
- Some advanced rollback and reconciliation policy branches are scaffolded and can be expanded for destination-specific edge cases.
- Local operator walkthrough with demo fixture IDs renders protected surfaces and controls, but project-scoped API calls return `500` for non-seeded IDs. Seeded fixture walkthrough should be used for final UAT screenshots.
- Repository-wide TypeScript debt remains tracked in `docs/gmp/gmp-0005c-typescript-debt-register.md`.
- Intermittent Jest post-run open-handle warning text remains non-actionable under `--detectOpenHandles` and is tracked as non-blocking technical debt.

## GMP-0006 Recommendations
- Complete destination-specific transports for WordPress and add additional adapters (headless CMS/static export) with parity tests.
- Expand release dependency graph validation (topological checks, stop/continue policy tuning).
- Add richer reconciliation diff UX and operator action playbooks for drift resolution.
- Add stronger remote-state fingerprint normalizers per destination type for reduced verification false positives.
