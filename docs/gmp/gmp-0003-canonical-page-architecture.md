# GMP-0003 Canonical Page Architecture & Content Planning Engine

## Scope
This implementation adds additive data contracts, persistence, deterministic planning services, API routes, policy actions, and focused tests for canonical page architecture and content planning.

## Delivered Components

### Data Model
- Additive Prisma models for pages, briefs, plans, sections, relationships, internal links, governance, readiness, and traceability references.
- New migration: `prisma/migrations/20260726165000_gmp_page_architecture/migration.sql`.

### Domain Contracts
- `src/lib/gmp/page-models.ts`
- Canonical page types, lifecycle states, section taxonomy, planning/readiness model versions.
- Input validation and canonical page builder helpers.

### Repository Layer
- `src/lib/gmp/page-repository.ts`
- Prisma and in-memory repository implementations for:
  - Page CRUD/listing.
  - Brief CRUD/listing.
  - Content plan CRUD/listing.
  - Section replacement/listing.
  - Relationship and internal-link storage.
  - Readiness storage/retrieval.
  - Knowledge/source reference persistence.

### Deterministic Services
- `src/lib/gmp/page-services.ts`
- Deterministic planner behavior:
  - Selects page-type templates.
  - Produces stable section plans and ordering.
  - Persists knowledge/source references.
  - Derives internal links from page relationships.
- Readiness behavior:
  - Scores planning, knowledge, SEO, evidence, linking.
  - Produces blocking issues/warnings/recommendations.
- GOP execution tracking for plan generation and readiness runs.

### API Surface
- `src/lib/gmp/page-api.ts`
- Workspace-isolated, policy-protected handlers for:
  - Pages list/create/get/update/archive.
  - Brief list/create.
  - Plan get/generate.
  - Relationships list/upsert.
  - Internal links list.
  - Readiness get/run.

### Routes
- `src/app/api/gmp/projects/[id]/pages/route.ts`
- `src/app/api/gmp/pages/[pageId]/route.ts`
- `src/app/api/gmp/pages/[pageId]/briefs/route.ts`
- `src/app/api/gmp/pages/[pageId]/plans/route.ts`
- `src/app/api/gmp/pages/[pageId]/plans/generate/route.ts`
- `src/app/api/gmp/pages/[pageId]/relationships/route.ts`
- `src/app/api/gmp/pages/[pageId]/internal-links/route.ts`
- `src/app/api/gmp/pages/[pageId]/readiness/route.ts`
- `src/app/api/gmp/pages/[pageId]/readiness/run/route.ts`

### Policy Actions
- Added page architecture actions to `src/platform/gop/auth/policies.ts`:
  - `gmp:page:view`
  - `gmp:page:create`
  - `gmp:page:edit`
  - `gmp:page:archive`
  - `gmp:page:restore`
  - `gmp:page:brief_manage`
  - `gmp:page:plan_manage`
  - `gmp:page:relationships_manage`
  - `gmp:page:links_manage`
  - `gmp:page:review_submit`
  - `gmp:page:approve`
  - `gmp:page:reject`
  - `gmp:page:readiness_run`
  - `gmp:page:preview_unapproved`

## Validation
- `npx prisma validate` passed.
- `npx jest tests/gmp/gmp-page-services.test.ts tests/gmp/gmp-page-api.test.ts --runInBand` passed.
- `npx jest tests/gmp --runInBand` passed.

## Notes
- This slice intentionally focuses on canonical architecture/planning and governance readiness signals.
- Non-goals remain unchanged: no copy generation, no publishing execution, no vector retrieval, and no blog/media full stack expansion.

## GMP-0003C Intelligence Layer

### Authoritative Services
- `src/lib/gmp/page-graph-service.ts` is authoritative for page-graph topology, structural relationships, canonical chains, disconnected state, and graph health scoring.
- `src/lib/gmp/page-link-service.ts` is authoritative for internal-link intelligence, link-density diagnostics, broken targets, orphan state, and link health scoring.
- `src/lib/gmp/page-health-service.ts` is authoritative for the shared health-report contract, readiness aggregation, knowledge health, SEO health, and overall planning health.

### Shared Health Report Contract
- Frozen report versions:
  - `gmp-page-graph/v1`
  - `gmp-page-link/v1`
  - `gmp-page-health/v1`
  - `gmp-page-health-report/v1`
- Shared report fields include:
  - `reportVersion`
  - `projectId`
  - `siteId?`
  - `pageId?`
  - `generatedAt`
  - `graphModelVersion`
  - `linkModelVersion`
  - `relationshipHealth`
  - `linkHealth`
  - `readinessHealth`
  - `knowledgeHealth`
  - `seoHealth`
  - `overallPlanningHealth`
  - `diagnostics`
  - `latestGopExecutions`

### Relationship Intelligence Rules
- Relationship health is derived from the graph service only.
- Rule identifiers:
  - `page.graph.circular`
  - `page.graph.duplicate-canonical-target`
  - `page.graph.disconnected`
  - `page.graph.unused-page`
- Deterministic tie-breakers:
  - Chain traversal is stable and depth-limited by insertion order in the repository result sets.
  - Generated timestamps are derived from repository state, not the wall clock.

### Internal-Link Intelligence Rules
- Link health is derived from the link service only.
- Rule identifiers:
  - `page.link.broken-target`
  - `page.link.duplicate`
  - `page.link.orphan`
- Link-density diagnostics include inbound count, outbound count, required links, recommended links, missing required links, broken targets, duplicate targets, orphan pages, and weak cluster/pillar coverage.

### Health Scoring Model
- Relationship, link, readiness, knowledge, SEO, and overall planning health are scored as deterministic 0-100 values.
- Severity model:
  - `ERROR` blocks health.
  - `WARNING` reduces score and informs remediation.
  - `INFO` is reserved for non-blocking context.
- Overall planning health is an aggregate score derived from the component scores.

### Dashboard Metric Definitions
- `Pages Ready`: pages with latest readiness score at or above 80.
- `Pages Blocked`: pages with one or more readiness blocking issues.
- `Average Readiness`: arithmetic mean of latest readiness scores.
- `Knowledge-Blocked Pages`: pages whose readiness blockers include `knowledge_references_missing`.
- `Evidence-Missing Pages`: pages whose approved brief lacks evidence requirements.
- `SEO-Blocked Pages`: pages with broken planned links or canonical-target conflicts.
- `Orphan Pages`: pages with no inbound or outbound link coverage.
- `Broken Relationships`: relationship-graph issues marked as `ERROR` or graph-disconnect indicators.
- `Circular References`: detected parent, redirect, or canonical cycles.
- `Weak Pillars`: pages or clusters with no meaningful pillar coverage.
- `Weak Clusters`: clusters whose coverage or grouping is below the service threshold.
- `Missing Internal Links`: pages with no outbound planned links when one is expected.
- `Broken Planned Links`: internal-link plans whose target page is missing from the graph.
- `Duplicate Canonicals`: canonical sources that point to multiple canonical targets.
- `Disconnected Pages`: pages not connected to the current structural graph.
- `Recent Relationship Scans`: latest GOP executions filtered to `relationship_scan`.
- `Recent Link Scans`: latest GOP executions filtered to `link_scan`.
- `Recent Planning Health Scans`: latest GOP executions filtered to `planning_health_scan`, `project_architecture_scan`, or `dashboard_refresh`.

### Route Inventory
- `GET /api/gmp/pages/[pageId]/health`
- `POST /api/gmp/pages/[pageId]/health/run`
- `GET /api/gmp/pages/[pageId]/relationships/health`
- `POST /api/gmp/pages/[pageId]/relationships/scan`
- `GET /api/gmp/pages/[pageId]/internal-links/health`
- `POST /api/gmp/pages/[pageId]/internal-links/scan`
- `GET /api/gmp/projects/[id]/page-architecture/health`
- `POST /api/gmp/projects/[id]/page-architecture/scan`
- Existing management routes remain intact for page detail, relationships, and internal links.

### UI Ownership
- Presentation-only components:
  - `src/components/gmp/gmp-pages-workspace.tsx`
  - `src/components/gmp/gmp-project-dashboard.tsx`
  - `src/components/gmp/gmp-relationship-health.tsx`
  - `src/components/gmp/gmp-link-health.tsx`
  - `src/components/gmp/gmp-architecture-summary.tsx`
  - `src/components/gmp/gmp-page-graph.tsx`
- These components render the authoritative report and do not calculate graph, link, or health scores locally.

### GOP Execution Integration
- Health scans now produce or reference GOP executions for relationship, link, and architecture scans.
- Execution metadata includes project, page, operation type, timestamp, and report-version context when available.

### Operator Remediation Workflow
- Review the score and rule IDs in the health panel.
- Inspect affected pages and the raw relationship/link lists.
- Add or remove relationships and planned links.
- Rerun the relevant scan.
- Confirm the new report timestamp and score movement.

### Future Consumer Contract
- Future Blog, SEO, Campaign, and Publishing engines must consume the shared health report and not recompute graph or link intelligence in the client.
- Any new consumer should read the report contract first, then layer presentation logic on top of the authoritative service output.

## Final Release Metadata
- Version: 1.0
- Status: Approved
- Disposition: Frozen for Future Reference
- Certification date: 2026-07-26
- Health contract version: `gmp-page-health-report/v1`
- Planning model version: `gmp-page-plan/v1`
- Relationship rule version: `gmp-page-graph/v1`
- Internal-link rule version: `gmp-page-link/v1`
- Readiness model version: `gmp-page-readiness/v1`
- Migration dependencies:
  - `20260726093000_gop_execution_store`
  - `20260726103000_gop_runtime_fabric`
  - `20260726114500_gmp_projects_and_sites`
  - `20260726143000_gmp_knowledge_workspace`
  - `20260726165000_gmp_page_architecture`
- Freeze-report reference: `docs/gmp/gmp-0003c-freeze-report.md`
