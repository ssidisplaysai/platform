# GMP-0001: Projects & Site Management

## Milestone Goal
GMP-0001 establishes the canonical enterprise workspace foundation for Genesis Marketing Platform by introducing project, site, brand profile, and publishing connection management with GOP-integrated operations visibility.

This milestone adds product-domain management surfaces on top of GOP v1 runtime and does not alter GOP runtime contracts.

## Delivered Scope
- Additive Prisma schema models and migration for:
  - `GmpProject`
  - `GmpSite`
  - `GmpBrandProfile`
  - `GmpPublishingConnection`
  - `GmpEnvironmentConfig`
- GMP domain model and validators in `src/lib/gmp/models.ts`.
- GMP repository implementations in `src/lib/gmp/repository.ts`:
  - Prisma-backed repository
  - in-memory repository for tests
- GMP authorization actions integrated into GOP policy surface:
  - `gmp:project:view`
  - `gmp:project:manage`
- GLW navigation integration for `/glw/projects`.
- GMP API service layer in `src/lib/gmp/api.ts`.
- App Router API routes under `src/app/api/gmp/**`.
- Protected GLW project pages:
  - `/glw/projects`
  - `/glw/projects/[id]`
- GMP UI components:
  - `GmpProjectsWorkspace`
  - `GmpProjectDashboard`
  - `GmpSitesWorkspace`
- API tests in `tests/gmp/gmp-api.test.ts`.

## API Surface
### Projects
- `GET /api/gmp/projects`
- `POST /api/gmp/projects`
- `GET /api/gmp/projects/[id]`
- `PATCH /api/gmp/projects/[id]`
- `DELETE /api/gmp/projects/[id]`

### Sites
- `GET /api/gmp/projects/[id]/sites`
- `POST /api/gmp/projects/[id]/sites`
- `PATCH /api/gmp/sites/[id]`
- `DELETE /api/gmp/sites/[id]`

### Brand Profile
- `GET /api/gmp/projects/[id]/brand-profile`
- `PUT /api/gmp/projects/[id]/brand-profile`

### Publishing Connections
- `GET /api/gmp/sites/[id]/connections`
- `POST /api/gmp/sites/[id]/connections`
- `PATCH /api/gmp/connections/[id]`
- `DELETE /api/gmp/connections/[id]`

### Dashboard
- `GET /api/gmp/projects/[id]/dashboard`
  - Aggregates project + site + connection state
  - Includes GOP runtime operations snapshot
  - Includes placeholders for business genome/content/SEO status

## Authorization Model
- Session-backed GLW authentication is unchanged.
- GOP policy resolver enforces project read/manage actions.
- Workspace scoping is applied across handlers using `workspaceId` query parameter fallback to `glw-led-display-warehouse`.
- Cross-workspace project access returns `404`.

## Data and Runtime Integration
- Dashboard endpoint calls GOP runtime via:
  - `getGenesisOrchestrationRuntime().buildOperationsSnapshot(...)`
- GMP does not fork GOP runtime logic; it composes with existing orchestration telemetry.

## Quality Gates
- Type safety diagnostics checked for:
  - `src/lib/gmp/api.ts`
  - `tests/gmp/gmp-api.test.ts`
  - protected GMP pages
- API enum parsing normalized and hardened for:
  - project status/lifecycle
  - site environment/platform/status/auth
  - connection provider/environment/status/auth

## Test Coverage
`tests/gmp/gmp-api.test.ts` validates:
- unauthorized access handling
- project create/list flow
- workspace isolation behavior
- site create/update flow
- publishing connection create/list/archive flow
- dashboard payload shape and GOP integration contract

## Migration
- `prisma/migrations/20260726114500_gmp_projects_and_sites/migration.sql`
- Additive-only changes; no runtime architecture replacement.

## Operational Notes
- This milestone intentionally leaves content/SEO/business-genome deep metrics as placeholders for future GMP milestones.
- Existing GLW and GOP behavior is preserved.

## Validation Commands
- `npm run lint`
- `npm test -- tests/gmp/gmp-api.test.ts`
- `npx prisma validate`
- `npx prisma migrate status`
