# GMP-0004 Content Generation, Revision & Editorial Governance

## Scope
GMP-0004 introduces a durable content-draft and editorial-governance layer on top of the frozen GMP-0003 planning system. Content generation remains derived from approved Project, Site, Brand, Knowledge, Brief, Content Plan, and Section architecture. It does not mutate the canonical planning objects and does not publish externally.

## Canonical Hierarchy
- Project
- Site
- Page
- Approved Brief
- Approved Content Plan
- Canonical Sections
- Content Draft
- Section Content
- Section Revisions
- Editorial Review
- Approved Content Revision
- Future Publishing Package

## Data Model
Additive Prisma models introduced by migration `20260726202509_gmp_content_generation_editorial_governance`:
- `GmpContentDraft`
- `GmpGenerationRequest`
- `GmpSectionContent`
- `GmpSectionContentRevision`
- `GmpContentReview`
- `GmpContentApproval`
- `GmpContentValidation`
- `GmpSectionValidation`
- `GmpGenerationLineage`
- `GmpContentAssembly`

## Content Draft Model
`GmpContentDraft` stores the durable draft envelope, including:
- page, brief, plan, knowledge workspace, and brand versions
- generation, editorial, and approval state
- provider, model, generation-policy version, and prompt-adapter version
- operator lineage fields such as createdBy, submittedAt, approvedAt, rejectedAt, and supersededAt

## Section Content Model
`GmpSectionContent` stores generated or edited output for one canonical section and is the canonical generated artifact for this milestone.
It captures:
- heading and body content
- structured CTA and media guidance
- internal-link suggestions
- evidence, source, claim, and knowledge references
- restriction evaluation
- generation, editorial, and approval statuses
- word count and reading-level metadata

## Revision Model
`GmpSectionContentRevision` preserves immutable history for:
- manual edits
- AI-assisted revisions
- section regeneration
- reviewer-requested changes

Every revision stores previous content, new content, reason, instruction, provider/model metadata, fingerprint, knowledge impact, evidence impact, and validation result.

## Generation Eligibility
The authoritative eligibility service lives in `src/lib/gmp/content-services.ts`.
It deterministically requires:
- active page and valid site ownership
- approved brief
- approved content plan
- required sections present
- readiness without blocking issues
- resolved knowledge conflicts
- approved required claims
- evidence references available
- brand profile present

Eligibility output includes:
- `eligible`
- `blockingIssues`
- `warnings`
- `requiredInputs`
- `missingInputs`
- page, brief, plan, and knowledge-workspace versions
- `gmp-content-eligibility/v1`

## Canonical Generation Input
Machine-readable contract: `src/lib/gmp/content-contracts.ts`

Schema constants included:
- `gmpGenerationInputSchema`
- `gmpSectionOutputSchema`
- `gmpValidationReportSchema`
- `gmpGenerationLineageSchema`
- `gmpContentPreviewSchema`

The canonical input includes:
- project identity
- site identity
- page identity and intent
- approved brief
- approved content plan
- current section specification
- approved knowledge values and versions
- claims and proof points
- evidence references
- restrictions
- brand voice and audience guidance
- SEO, CTA, internal-link, and accessibility requirements
- locale and language
- generation-policy version
- input schema version

## Input Fingerprint
`stableInputFingerprint()` in `src/lib/gmp/content-models.ts` computes a stable SHA-256 fingerprint from the canonical structured input.

Identical canonical inputs produce the same fingerprint.

## Provider Abstraction
Provider boundary: `src/lib/gmp/content-provider.ts`

Interface surface:
- `generateSection()`
- `reviseSection()`
- `repairSection()`
- `validateOutput()`

Current implementation:
- deterministic OpenAI-compatible provider contract
- centralized server-side prompt adapter and provider selection
- no provider secret exposure to the client

## Prompt Adapter
Prompt adapter responsibilities:
- derive provider messages from structured input
- carry prompt-adapter version
- carry provider and model identifier
- carry input fingerprint
- carry output schema version

Canonical business state remains the structured input object, not prompt text.

## Structured Output
Each provider result is validated before persistence.
Minimum section output includes:
- section key
- heading
- body
- CTA
- claims used
- knowledge records used
- evidence references used
- internal links suggested
- media guidance
- warnings
- unresolved requirements
- generation notes
- output schema version

Malformed output is rejected rather than silently persisted.

## Orchestration Model
Generation is section-by-section and preserves partial success.

Workflow:
1. Evaluate eligibility.
2. Create content draft.
3. Create generation request.
4. Build section-specific canonical input.
5. Create GOP execution association.
6. Generate section output.
7. Validate output.
8. Persist section content.
9. Persist revision.
10. Persist lineage.
11. Run section validation.
12. Run draft validation.
13. Assemble preview.

One failed section does not discard successful sections.

## GOP Integration
GMP-0004 uses GOP execution creation for content operations and stores the resulting execution id on generation requests and lineage records.

Associated metadata includes:
- project id
- site id
- page id
- content draft id
- operation type
- generation request id

GMP-0004 does not reimplement GOP retries, events, queue behavior, or worker lifecycle.

## Claim Validation
Current deterministic claim validation classifies statements referenced in section artifacts as:
- `SUPPORTED_CLAIM`
- `UNSUPPORTED_CLAIM`

The model leaves explicit extension points for:
- `UNVERIFIED_CLAIM`
- `RESTRICTED_CLAIM`
- `PROHIBITED_CLAIM`
- `GENERAL_MARKETING_STATEMENT`

Unsupported claims block approval.

## Restriction Enforcement
Restrictions are derived from:
- approved restricted-messaging knowledge records
- brief-level restricted messaging

Blocking restriction terms found in generated or edited content create validation blockers and prevent section or draft approval.

## Editorial Validation
Current deterministic editorial validation checks:
- missing heading
- missing body
- section word-range violations
- CTA absence
- unsupported claims
- restricted messaging violations

Outputs include:
- overall editorial score
- section scores
- blocking issues
- warnings
- recommendations
- validation model version `gmp-editorial-validation/v1`

## Review And Approval Workflow
Draft workflow:
- draft
- ready for review
- in review
- changes requested
- approved
- rejected

Section workflow:
- generated/editing
- in review
- changes requested
- approved
- rejected

Approval is blocked when:
- draft validation has blockers
- section validation has blockers
- sections are not approved

## API Surface
Eligibility:
- `GET /api/gmp/pages/[pageId]/content/eligibility`

Drafts:
- `GET /api/gmp/pages/[pageId]/content/drafts`
- `POST /api/gmp/pages/[pageId]/content/drafts`
- `GET /api/gmp/content/drafts/[draftId]`
- `PATCH /api/gmp/content/drafts/[draftId]`

Generation:
- `POST /api/gmp/content/drafts/[draftId]/generate`
- `POST /api/gmp/content/drafts/[draftId]/repair`
- `GET /api/gmp/content/drafts/[draftId]/generation-status`

Sections:
- `GET /api/gmp/content/drafts/[draftId]/sections`
- `GET /api/gmp/content/sections/[sectionContentId]`
- `PATCH /api/gmp/content/sections/[sectionContentId]`
- `POST /api/gmp/content/sections/[sectionContentId]/regenerate`
- `POST /api/gmp/content/sections/[sectionContentId]/revise`
- `POST /api/gmp/content/sections/[sectionContentId]/validate`
- `GET /api/gmp/content/sections/[sectionContentId]/revisions`

Review:
- `POST /api/gmp/content/drafts/[draftId]/review`
- `POST /api/gmp/content/drafts/[draftId]/approve`
- `POST /api/gmp/content/drafts/[draftId]/reject`
- `POST /api/gmp/content/drafts/[draftId]/request-changes`
- `POST /api/gmp/content/sections/[sectionContentId]/review`
- `POST /api/gmp/content/sections/[sectionContentId]/approve`
- `POST /api/gmp/content/sections/[sectionContentId]/reject`
- `POST /api/gmp/content/sections/[sectionContentId]/request-changes`

Validation:
- `GET /api/gmp/content/drafts/[draftId]/validation`
- `POST /api/gmp/content/drafts/[draftId]/validation/run`

Lineage and Preview:
- `GET /api/gmp/content/drafts/[draftId]/lineage`
- `GET /api/gmp/content/drafts/[draftId]/preview`

## Protected UI Routes
- `/glw/projects/[id]/pages/[pageId]/content`
- `/glw/projects/[id]/pages/[pageId]/content/generate`
- `/glw/projects/[id]/pages/[pageId]/content/[draftId]`
- `/glw/projects/[id]/pages/[pageId]/content/[draftId]/review`
- `/glw/projects/[id]/pages/[pageId]/content/[draftId]/lineage`

## Dashboard Integration
The project dashboard now reports content-generation readiness and draft activity, including:
- pages eligible for generation
- pages blocked from generation
- drafts generating/generated/in review/changes requested/approved
- failed generation requests
- sections generated/failed/awaiting review
- average editorial score
- claim validation failures
- restriction violations
- recent content-generation executions

## Authorization Model
Content actions added to GOP policy surface:
- `gmp:content:view`
- `gmp:content:create`
- `gmp:content:generate`
- `gmp:content:regenerate_section`
- `gmp:content:revise_section`
- `gmp:content:edit_generated`
- `gmp:content:submit_review`
- `gmp:content:review`
- `gmp:content:request_changes`
- `gmp:content:approve_section`
- `gmp:content:reject_section`
- `gmp:content:approve_draft`
- `gmp:content:reject_draft`
- `gmp:content:run_validation`
- `gmp:content:view_lineage`
- `gmp:content:preview_unapproved`
- `gmp:content:archive`

All routes preserve session authentication, workspace isolation, project isolation, page ownership, site ownership, and default-deny behavior.

## Future Publishing Integration
GMP-0004 stops at generated, reviewed, approved editorial artifacts and assembled preview state.
Future publishing work must consume approved revisions and lineage rather than generating directly from briefs or plans.
