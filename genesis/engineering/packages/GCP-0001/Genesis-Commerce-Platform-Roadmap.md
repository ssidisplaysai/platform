# Genesis Commerce Platform Roadmap

## Roadmap Scope
Architecture and implementation planning only. No production implementation starts in this package.

## Implementation Phases
### Phase 0 Platform Recovery
Objectives:
- Restore local development environment baseline
- Validate required services and dashboard availability
- Validate page generation, n8n, and WordPress publishing paths
- Establish operational evidence baseline

Dependencies:
- None

### Phase 1 Application Architecture
Objectives:
- Define navigation and UX structure
- Define module boundaries and ownership
- Define Genesis, Business Genome, and Marketing Kernel integrations
- Define permission and AI architecture

Dependencies:
- Phase 0

### Phase 2 Commerce Foundation
Objectives:
- Define auth integration strategy
- Define user, role, organization, site, settings, and audit models
- Define workspace management and notifications boundaries

Implementation checkpoint:
- GCP-0002B completed bounded foundation implementation for shell navigation, org/site context, application permissions, settings structure, notification framework, audit foundation, command palette foundation, and enterprise search foundation.
- Commerce operations and platform authority integrations remain out of scope for this checkpoint.

Dependencies:
- Phase 1

### Phase 3 Multi-Site Platform
Objectives:
- Define Site Registry architecture
- Define tenant branding/domain/publishing profile models
- Define health and environment status model
- Enforce no-secret storage in application records

Implementation checkpoint:
- GCP-0002C implemented bounded multi-site foundation routes, typed site configuration contracts, deterministic readiness/publishing guard policy, and non-secret integration reference handling.
- Runtime publishing, workflow execution, and external authority integrations remain out of scope.

Dependencies:
- Phase 2

### Phase 4 Commerce Operations
Objectives:
- Define product, catalog, pricing, inventory, customer, order architecture
- Define quote and project workflow model
- Define media and document operational boundaries
- Align canonical entities with Business Genome where available

Dependencies:
- Phase 2 and Phase 3

### Phase 5 Marketing Integration
Objectives:
- Integrate Marketing Kernel consumption model
- Define SEO, landing page, blog, image, publishing, scheduling, and campaign boundaries
- Preserve no-duplication marketing principle

Dependencies:
- Phase 3 and Phase 4

### Phase 6 Business Genome Integration
Objectives:
- Define canonical object display and navigation model
- Define evidence, relationships, version history, confidence, and source references model
- Define application read/write boundary contracts

Dependencies:
- Phase 3 and Phase 4

### Phase 7 AI Workspace
Objectives:
- Define unified AI workspace architecture
- Define enterprise search, content generation, insights, and automation generation boundaries
- Define policy and approval controls for generated outputs

Dependencies:
- Phase 5 and Phase 6

### Phase 8 Analytics
Objectives:
- Define executive dashboard and metrics architecture
- Define publishing, SEO, commerce, customer, inventory, workflow, and AI activity metrics
- Define Business Genome and system health analytics consumption

Dependencies:
- Phase 4, Phase 5, and Phase 6

### Phase 9 Automation
Objectives:
- Define workflow-driven end-to-end automation architecture
- Define product-to-publish-to-CRM orchestration blueprint
- Define feedback loops into analytics and Business Genome updates

Dependencies:
- Phase 5, Phase 6, Phase 7, and Phase 8

## Dependency Matrix
| From | To | Dependency Type | Rationale |
|---|---|---|---|
| Phase 0 | Phase 1 | Hard gate | Architecture cannot be validated without operational baseline |
| Phase 1 | Phase 2 | Hard gate | Foundation model requires approved ownership boundaries |
| Phase 2 | Phase 3 | Hard gate | Multi-site registry depends on org/site/auth foundations |
| Phase 2 | Phase 4 | Hard gate | Commerce operations require foundation entities |
| Phase 3 | Phase 5 | Hard gate | Marketing targeting requires site and profile definitions |
| Phase 4 | Phase 5 | Soft gate | Commerce catalog enriches marketing context |
| Phase 3 | Phase 6 | Hard gate | Genome consumption must map tenant and site scope |
| Phase 5 | Phase 7 | Hard gate | AI workspace uses marketing outputs and APIs |
| Phase 6 | Phase 7 | Hard gate | AI workspace uses Business Genome context |
| Phase 4 | Phase 8 | Hard gate | Analytics depends on commerce operational signals |
| Phase 5 | Phase 8 | Hard gate | Analytics depends on marketing activity and outcomes |
| Phase 6 | Phase 8 | Soft gate | Analytics can enrich with Genome confidence and lineage |
| Phase 7 | Phase 9 | Hard gate | Automation uses AI planning and assistants |
| Phase 8 | Phase 9 | Hard gate | Automation optimization requires analytics feedback |

## Scope Partitions
### MVP Scope
- Phases 0 through 5 with limited Phase 6 read-only integration
- One production tenant with core commerce and publishing lifecycle

### Production v1 Scope
- Full Phases 0 through 8 and bounded Phase 9 automations
- Multi-tenant onboarding with governed templates and approvals

### Future Enterprise Scope
- Full Phases 0 through 9 with cross-tenant intelligence and expanded partner automations

## Roadmap Risks
- Integration timing mismatch between application and platform services
- Scope inflation in AI workspace and automation phases
- Tenant isolation and credential handling complexity
- Analytics quality risk if source events are inconsistent

## Completion Condition For Roadmap
Roadmap is complete when all modules have assigned phase ownership, explicit dependencies, and governance-aligned boundaries.

## Progress Snapshot
- Phase 0: COMPLETE WITH EXTERNAL CONDITIONS (per GCP-0002A-R1)
- Phase 1: Architecture package complete
- Phase 2: Foundation implementation baseline established by GCP-0002B
- Phase 3: Multi-site platform foundation established by GCP-0002C bounded implementation
- Phase 4: Product and catalog foundation established by GCP-0002D bounded implementation
- Phase 4: Inventory and availability foundation established by GCP-0002E bounded implementation
- Phase 4: Integration profiles and publishing configuration foundation established by GCP-0002F bounded implementation
