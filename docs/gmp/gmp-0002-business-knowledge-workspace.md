# GMP-0002: Business Knowledge Workspace & Canonical Marketing Context

## Scope
GMP-0002 introduces a durable, structured, reviewable marketing knowledge workspace per project.

This milestone is intentionally narrower than Genesis Business Genome (GBG). GMP manages operator-curated, marketing-relevant canonical context with source traceability, conflict visibility, completeness scoring, and deterministic context assembly.

## Architectural Boundary (GMP vs GBG)
### GMP-0002 owns
- Marketing-relevant structured knowledge records.
- Project-scoped source references and evidence links.
- Review and approval lifecycle.
- Deterministic conflict detection and resolution workflow.
- Deterministic completeness scoring.
- Deterministic context assembly for GMP operations.

### GMP-0002 does not own
- Generic ingestion pipelines.
- Enterprise semantic extraction.
- Knowledge graph/ontology generation.
- Cross-enterprise entity resolution.
- Vector search or RAG infrastructure.
- Full GBG compilation.

## Prisma Additions
Additive models:
- `GmpBusinessKnowledgeWorkspace`
- `GmpKnowledgeRecord`
- `GmpKnowledgeRecordVersion`
- `GmpKnowledgeSource`
- `GmpKnowledgeEvidenceLink`
- `GmpKnowledgeReview`
- `GmpKnowledgeApproval`
- `GmpKnowledgeConflict`
- `GmpKnowledgeConflictMember`
- `GmpKnowledgeCompletenessAssessment`
- `GmpContextAssemblyRecord`

Migration:
- `prisma/migrations/20260726143000_gmp_knowledge_workspace/migration.sql`

## Knowledge Workspace Model
Each project has exactly one canonical business knowledge workspace (`projectId` unique).

Core fields:
- `knowledgeWorkspaceId`
- `projectId`
- `workspaceVersion`
- `status`
- `lifecycleState` (`DRAFT`, `IN_REVIEW`, `APPROVED`, `SUPERSEDED`, `ARCHIVED`)
- `completenessScore`
- `confidenceScore`
- `lastReviewedAt`
- `lastApprovedAt`
- `approvedBy`
- `createdAt`
- `updatedAt`
- `metadata`

## Knowledge Domains
Supported minimum domains:
- Company Identity
- Brand
- Products
- Services
- Product Categories
- Applications
- Industries
- Audiences
- Buyer Personas
- Problems Solved
- Value Propositions
- Differentiators
- Features
- Benefits
- Use Cases
- Technical Specifications
- Pricing Context
- Geographic Markets
- Competitors
- Claims
- Frequently Asked Questions
- Objections
- Proof Points
- Certifications
- Warranties
- Policies
- Contact and Conversion Information
- Marketing Goals
- SEO Topics
- Restricted or Prohibited Messaging

## Canonical Record Model
`GmpKnowledgeRecord` captures project-scoped, workspace-scoped canonical records with:
- domain/type/key/title/summary
- structured + normalized values
- status/review/conflict state
- confidence/priority
- effective dates
- source count
- parent-child links
- supersede links
- explicit version field

## Evidence Model
`GmpKnowledgeSource` and `GmpKnowledgeEvidenceLink` provide source traceability:
- source registry supports manual/document/web/API/future-GBG source types.
- evidence links connect records to sources with location, summary, extraction method, verification actor/time, and confidence.

## Versioning
`GmpKnowledgeRecordVersion` stores immutable change history:
- previous value
- new value
- change reason
- changed by / changed at
- source impact
- approval impact

Approved records are protected:
- direct overwrite is blocked.
- edits require superseding draft creation (`forceSupersede=true`).

## Review and Approval Lifecycle
Lifecycle operations in service + API:
- submit for review
- approve
- reject
- archive
- restore (repository primitive)

States are persisted per record and review/approval history entries are stored separately.

## Conflict Model
Deterministic scan rule:
- active records grouped by `(domain, canonicalKey)`
- if more than one active record has differing normalized/structured values, emit conflict group

Captured as:
- `GmpKnowledgeConflict`
- `GmpKnowledgeConflictMember`

Resolution supports selected canonical record, notes, actor, and timestamp.

## Completeness Scoring Model
Model version: `gmp-completeness/v1`

Rule-based deterministic scoring across critical/recommended canonical keys for:
- company identity
- brand voice
- audiences
- products/services
- value props
- differentiators
- applications
- industries
- claims/proof
- conversion contact
- goals/topics/restrictions

Outputs:
- overall score
- per-domain scores
- missing critical/recommended fields
- conflicted fields
- unapproved fields
- expired fields

## Context Assembly Contract
Assembler output schema version: `gmp-context/v1`

Primary output is structured JSON containing:
- project identity
- site context
- knowledge workspace metadata/version
- domain-organized knowledge entries
- restrictions section
- traceability metadata

Contract assets:
- TypeScript contract: `src/lib/gmp/knowledge-context-contract.ts`
- JSON-schema constant: `gmpKnowledgeContextSchema`

Default behavior:
- approved-only records.
- preview mode allows active drafts when explicitly requested.

## GOP Integration
Knowledge operations generate GOP executions for operational visibility and reuse:
- conflict scan
- completeness assessment
- context assembly

Associated metadata includes project id, operation type, and affected record ids.

## Authorization Model
New policy actions:
- `gmp:knowledge:view`
- `gmp:knowledge:create`
- `gmp:knowledge:edit_draft`
- `gmp:knowledge:submit_review`
- `gmp:knowledge:review`
- `gmp:knowledge:approve`
- `gmp:knowledge:reject`
- `gmp:knowledge:archive`
- `gmp:knowledge:manage_sources`
- `gmp:knowledge:resolve_conflicts`
- `gmp:knowledge:run_completeness`
- `gmp:knowledge:assemble_context`
- `gmp:knowledge:preview_unapproved`

Workspace-scoped checks preserve isolation and default-deny behavior.

## API Surface
Implemented endpoints:
- `GET /api/gmp/projects/[id]/knowledge`
- `POST /api/gmp/projects/[id]/knowledge/records`
- `GET /api/gmp/projects/[id]/knowledge/records`
- `GET /api/gmp/knowledge/records/[recordId]`
- `PATCH /api/gmp/knowledge/records/[recordId]`
- `DELETE /api/gmp/knowledge/records/[recordId]`
- `GET /api/gmp/knowledge/records/[recordId]/versions`
- `POST /api/gmp/knowledge/records/[recordId]/review`
- `POST /api/gmp/knowledge/records/[recordId]/approve`
- `POST /api/gmp/knowledge/records/[recordId]/reject`
- `POST /api/gmp/projects/[id]/knowledge/sources`
- `GET /api/gmp/projects/[id]/knowledge/sources`
- `POST /api/gmp/knowledge/records/[recordId]/evidence`
- `GET /api/gmp/projects/[id]/knowledge/conflicts`
- `POST /api/gmp/knowledge/conflicts/[conflictId]/resolve`
- `GET /api/gmp/projects/[id]/knowledge/completeness`
- `POST /api/gmp/projects/[id]/knowledge/completeness/run`
- `POST /api/gmp/projects/[id]/knowledge/context/assemble`

## UI Surfaces
Protected project-level routes:
- `/glw/projects/[id]/knowledge`
- `/glw/projects/[id]/knowledge/records`
- `/glw/projects/[id]/knowledge/sources`
- `/glw/projects/[id]/knowledge/conflicts`
- `/glw/projects/[id]/knowledge/review`

Features include overview/readiness, record CRUD-onramp, source registration, evidence linking, review controls, conflict center, completeness trigger, and context preview.

## Future GBG Compatibility
Compatibility posture:
- additive schema
- explicit source type for `FUTURE_GBG_OBJECT`
- contextual contract versioning
- separate normalized value channel

This allows future GBG canonical objects to enrich/replace record payloads without destructive changes.
