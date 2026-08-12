import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";
import { createPrismaGmpContentRepository, type GmpContentRepository } from "./content-repository";
import { createGmpContentServices, type GmpContentServices } from "./content-services";
import { type GmpContentDraft } from "./content-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.content";

type ContentAction =
  | "gmp:content:view"
  | "gmp:content:create"
  | "gmp:content:generate"
  | "gmp:content:regenerate_section"
  | "gmp:content:revise_section"
  | "gmp:content:edit_generated"
  | "gmp:content:submit_review"
  | "gmp:content:review"
  | "gmp:content:request_changes"
  | "gmp:content:approve_section"
  | "gmp:content:reject_section"
  | "gmp:content:approve_draft"
  | "gmp:content:reject_draft"
  | "gmp:content:run_validation"
  | "gmp:content:view_lineage"
  | "gmp:content:preview_unapproved"
  | "gmp:content:archive";

type ContentPermissions = {
  canCreateDraft: boolean;
  canGenerate: boolean;
  canEdit: boolean;
  canSubmitReview: boolean;
  canReview: boolean;
  canApprove: boolean;
  canRunValidation: boolean;
  canViewLineage: boolean;
};

export type GmpContentApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  pageRepository?: GmpPageRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
  contentRepository?: GmpContentRepository;
  contentServices?: GmpContentServices;
};

function deps(input?: GmpContentApiDependencies): Required<GmpContentApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const pageRepository = input?.pageRepository ?? createPrismaGmpPageRepository();
  const knowledgeRepository = input?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();
  const contentRepository = input?.contentRepository ?? createPrismaGmpContentRepository();
  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    pageRepository,
    knowledgeRepository,
    contentRepository,
    contentServices: input?.contentServices ?? createGmpContentServices({ projectRepository, pageRepository, knowledgeRepository, contentRepository }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

type ContentAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: { actionId: ContentAction; workspaceId: string; route: string; dependencies?: GmpContentApiDependencies }): Promise<ContentAuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) } as const;

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: { workspaceId: input.workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });
  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) } as const;
  return { subject } as const;
}

async function can(input: { actionId: ContentAction; workspaceId: string; route: string; dependencies?: GmpContentApiDependencies }): Promise<boolean> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) return false;
  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: { workspaceId: input.workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });
  return decision.allowed;
}

async function collectPermissions(workspaceId: string, dependencies?: GmpContentApiDependencies): Promise<ContentPermissions> {
  return {
    canCreateDraft: await can({ actionId: "gmp:content:create", workspaceId, route: "/api/gmp/pages/[pageId]/content/drafts", dependencies }),
    canGenerate: await can({ actionId: "gmp:content:generate", workspaceId, route: "/api/gmp/content/drafts/[draftId]/generate", dependencies }),
    canEdit: await can({ actionId: "gmp:content:edit_generated", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]", dependencies }),
    canSubmitReview: await can({ actionId: "gmp:content:submit_review", workspaceId, route: "/api/gmp/content/drafts/[draftId]/review", dependencies }),
    canReview: await can({ actionId: "gmp:content:review", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/review", dependencies }),
    canApprove: await can({ actionId: "gmp:content:approve_draft", workspaceId, route: "/api/gmp/content/drafts/[draftId]/approve", dependencies }),
    canRunValidation: await can({ actionId: "gmp:content:run_validation", workspaceId, route: "/api/gmp/content/drafts/[draftId]/validation/run", dependencies }),
    canViewLineage: await can({ actionId: "gmp:content:view_lineage", workspaceId, route: "/api/gmp/content/drafts/[draftId]/lineage", dependencies }),
  };
}

async function ensurePage(pageId: string, workspaceId: string, dependencies?: GmpContentApiDependencies) {
  const d = deps(dependencies);
  const page = await d.pageRepository.getPageById(pageId);
  if (!page) return null;
  const project = await d.projectRepository.getProjectById(page.projectId);
  if (!project || project.workspaceId !== workspaceId) return null;
  const site = await d.projectRepository.getSiteById(page.siteId);
  if (!site || site.projectId !== page.projectId) return null;
  return page;
}

async function ensureDraft(draftId: string, workspaceId: string, dependencies?: GmpContentApiDependencies) {
  const draft = await deps(dependencies).contentRepository.getDraftById(draftId);
  if (!draft) return null;
  const page = await ensurePage(draft.pageId, workspaceId, dependencies);
  return page ? draft : null;
}

async function ensureSection(sectionContentId: string, workspaceId: string, dependencies?: GmpContentApiDependencies) {
  const section = await deps(dependencies).contentRepository.getSectionContentById(sectionContentId);
  if (!section) return null;
  const draft = await ensureDraft(section.contentDraftId, workspaceId, dependencies);
  return draft ? section : null;
}

export async function handleGetContentEligibility(request: Request, pageId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/pages/[pageId]/content/eligibility", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);
  const [eligibility, permissions] = await Promise.all([
    deps(dependencies).contentServices.evaluateEligibility(pageId),
    collectPermissions(workspaceId, dependencies),
  ]);
  return json({ eligibility, permissions });
}

export async function handleListContentDrafts(request: Request, pageId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/pages/[pageId]/content/drafts", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);
  const [drafts, permissions] = await Promise.all([
    deps(dependencies).contentRepository.listDraftsForPage(pageId),
    collectPermissions(workspaceId, dependencies),
  ]);
  return json({ drafts, permissions });
}

export async function handleCreateContentDraft(request: Request, pageId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:create", workspaceId, route: "/api/gmp/pages/[pageId]/content/drafts", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const draft = await deps(dependencies).contentServices.createDraftForPage({
    pageId,
    actorId: access.subject.actorId,
    provider: typeof body.provider === "string" ? body.provider : undefined,
    modelIdentifier: typeof body.modelIdentifier === "string" ? body.modelIdentifier : undefined,
  });
  if (!draft) return json({ error: "Page is not eligible for content generation." }, 409);
  return json({ draft }, 201);
}

export async function handleGetContentDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/drafts/[draftId]", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);

  const d = deps(dependencies);
  const [sections, requests, reviews, approvals, validation, preview, permissions] = await Promise.all([
    d.contentRepository.listSectionContentsForDraft(draftId),
    d.contentRepository.listGenerationRequestsForDraft(draftId),
    d.contentRepository.listReviewsForDraft(draftId),
    d.contentRepository.listApprovalsForDraft(draftId),
    d.contentRepository.getLatestContentValidation(draftId),
    d.contentServices.getPreview(draftId),
    collectPermissions(workspaceId, dependencies),
  ]);
  return json({ draft, sections, requests, reviews, approvals, validation, preview, permissions });
}

export async function handlePatchContentDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:archive", workspaceId, route: "/api/gmp/content/drafts/[draftId]", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);
  const updated = await deps(dependencies).contentRepository.updateDraft(draftId, {
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
    generationStatus: typeof body.generationStatus === "string" ? body.generationStatus as GmpContentDraft["generationStatus"] : undefined,
    editorialStatus: typeof body.editorialStatus === "string" ? body.editorialStatus as GmpContentDraft["editorialStatus"] : undefined,
    approvalStatus: typeof body.approvalStatus === "string" ? body.approvalStatus as GmpContentDraft["approvalStatus"] : undefined,
  });
  return json({ draft: updated });
}

export async function handleGenerateContentDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:generate", workspaceId, route: "/api/gmp/content/drafts/[draftId]/generate", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const generated = await deps(dependencies).contentServices.generateDraft({
    draftId,
    actorId: access.subject.actorId,
    generationMode: typeof body.generationMode === "string" ? body.generationMode as never : undefined,
    requestedSections: Array.isArray(body.requestedSections) ? body.requestedSections.map(String) : undefined,
    operationType: typeof body.operationType === "string" ? body.operationType as never : undefined,
  });
  return json(generated, 201);
}

export async function handleRepairContentDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:generate", workspaceId, route: "/api/gmp/content/drafts/[draftId]/repair", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const sections = await deps(dependencies).contentRepository.listSectionContentsForDraft(draftId);
  const failedSections = sections.filter((section) => section.generationStatus === "GENERATION_FAILED").map((section) => section.pageSectionId);
  const repaired = await deps(dependencies).contentServices.generateDraft({ draftId, actorId: access.subject.actorId, generationMode: "REPAIR_FAILED_SECTIONS", requestedSections: failedSections, operationType: "FAILED_SECTION_REPAIR" });
  return json(repaired, 201);
}

export async function handleGetContentGenerationStatus(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/drafts/[draftId]/generation-status", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const status = await deps(dependencies).contentServices.getGenerationStatus(draftId);
  return json({ status });
}

export async function handleListDraftSections(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/drafts/[draftId]/sections", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const sections = await deps(dependencies).contentRepository.listSectionContentsForDraft(draftId);
  return json({ sections });
}

export async function handleGetSectionContent(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const [revisions, validation] = await Promise.all([
    deps(dependencies).contentRepository.listSectionRevisions(sectionContentId),
    deps(dependencies).contentRepository.getLatestSectionValidation(sectionContentId),
  ]);
  return json({ section, revisions, validation });
}

export async function handlePatchSectionContent(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:edit_generated", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);
  const updated = await deps(dependencies).contentServices.updateSectionDraft({
    sectionContentId,
    actorId: access.subject.actorId,
    heading: typeof body.heading === "string" ? body.heading : undefined,
    bodyContent: typeof body.bodyContent === "string" ? body.bodyContent : undefined,
    ctaContent: typeof body.ctaContent === "object" && body.ctaContent !== null ? body.ctaContent as Record<string, unknown> : undefined,
    mediaGuidance: typeof body.mediaGuidance === "object" && body.mediaGuidance !== null ? body.mediaGuidance as Record<string, unknown> : undefined,
    internalLinkSuggestions: Array.isArray(body.internalLinkSuggestions) ? body.internalLinkSuggestions as Array<Record<string, unknown>> : undefined,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });
  return json({ section: updated });
}

export async function handleRegenerateSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:regenerate_section", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/regenerate", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const draft = await deps(dependencies).contentRepository.getDraftById(section.contentDraftId);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const generated = await deps(dependencies).contentServices.generateDraft({ draftId: draft.contentDraftId, actorId: access.subject.actorId, generationMode: "REGENERATE_SECTION", requestedSections: [section.pageSectionId], operationType: "SECTION_REGENERATION" });
  return json(generated, 201);
}

export async function handleReviseSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:revise_section", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/revise", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const revised = await deps(dependencies).contentServices.reviseSection({ sectionContentId, actorId: access.subject.actorId, instruction: typeof body.instruction === "string" ? body.instruction : "Improve clarity.", revisionType: typeof body.revisionType === "string" ? body.revisionType as never : "AI_ASSISTED_REVISION" });
  return json({ section: revised }, 201);
}

export async function handleValidateSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:run_validation", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/validate", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const validation = await deps(dependencies).contentServices.validateSection(sectionContentId);
  return json({ validation }, 201);
}

export async function handleListSectionRevisions(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/revisions", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const revisions = await deps(dependencies).contentRepository.listSectionRevisions(sectionContentId);
  return json({ revisions });
}

export async function handleSubmitDraftReview(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:submit_review", workspaceId, route: "/api/gmp/content/drafts/[draftId]/review", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.submitDraftForReview(draftId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ draft: updated });
}

export async function handleApproveDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:approve_draft", workspaceId, route: "/api/gmp/content/drafts/[draftId]/approve", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.approveDraft(draftId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  if (!updated) return json({ error: "Draft approval is blocked by validation or unapproved sections." }, 409);
  return json({ draft: updated });
}

export async function handleRejectDraft(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:reject_draft", workspaceId, route: "/api/gmp/content/drafts/[draftId]/reject", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.rejectDraft(draftId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ draft: updated });
}

export async function handleRequestDraftChanges(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:request_changes", workspaceId, route: "/api/gmp/content/drafts/[draftId]/request-changes", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.requestDraftChanges(draftId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ draft: updated });
}

export async function handleApproveSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:approve_section", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/approve", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.approveSection(sectionContentId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  if (!updated) return json({ error: "Section approval is blocked by validation." }, 409);
  return json({ section: updated });
}

export async function handleReviewSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:review", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/review", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.reviewSection(sectionContentId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ section: updated });
}

export async function handleRejectSection(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:reject_section", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/reject", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.rejectSection(sectionContentId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ section: updated });
}

export async function handleRequestSectionChanges(request: Request, sectionContentId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:request_changes", workspaceId, route: "/api/gmp/content/sections/[sectionContentId]/request-changes", dependencies });
  if ("error" in access) return access.error;
  const section = await ensureSection(sectionContentId, workspaceId, dependencies);
  if (!section) return json({ error: "Section content not found." }, 404);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).contentServices.requestSectionChanges(sectionContentId, access.subject.actorId, typeof body.notes === "string" ? body.notes : undefined);
  return json({ section: updated });
}

export async function handleGetDraftValidation(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view", workspaceId, route: "/api/gmp/content/drafts/[draftId]/validation", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const validation = await deps(dependencies).contentRepository.getLatestContentValidation(draftId);
  return json({ validation });
}

export async function handleRunDraftValidation(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:run_validation", workspaceId, route: "/api/gmp/content/drafts/[draftId]/validation/run", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const validation = await deps(dependencies).contentServices.validateDraft(draftId);
  return json({ validation }, 201);
}

export async function handleGetDraftLineage(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:view_lineage", workspaceId, route: "/api/gmp/content/drafts/[draftId]/lineage", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const lineage = await deps(dependencies).contentServices.getLineage(draftId);
  return json({ lineage });
}

export async function handleGetDraftPreview(request: Request, draftId: string, dependencies?: GmpContentApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:content:preview_unapproved", workspaceId, route: "/api/gmp/content/drafts/[draftId]/preview", dependencies });
  if ("error" in access) return access.error;
  const draft = await ensureDraft(draftId, workspaceId, dependencies);
  if (!draft) return json({ error: "Draft not found." }, 404);
  const preview = await deps(dependencies).contentServices.getPreview(draftId);
  return json({ preview });
}