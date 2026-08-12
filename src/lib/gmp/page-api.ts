import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import { type GmpProject, type GmpSite } from "./models";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";
import { buildPage, gmpPageArtifactStatuses, validatePageBriefInput, validatePageCreateInput, type GmpContentPlan, type GmpPageArtifactStatus, type GmpPageBrief, type GmpPageLifecycleState, type GmpPageSection } from "./page-models";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";
import { createGmpPageServices, type GmpPageServices } from "./page-services";
import { buildPageHealthReport } from "./page-health-service";
import { buildPageGraph } from "./page-graph-service";
import { buildPageLinkSummary } from "./page-link-service";
import { type GmpHealthExecutionReference } from "./page-health-contract";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.pages";

type PageAction =
  | "gmp:page:view"
  | "gmp:page:create"
  | "gmp:page:edit"
  | "gmp:page:archive"
  | "gmp:page:restore"
  | "gmp:page:brief_manage"
  | "gmp:page:plan_manage"
  | "gmp:page:relationships_manage"
  | "gmp:page:links_manage"
  | "gmp:page:review_submit"
  | "gmp:page:approve"
  | "gmp:page:reject"
  | "gmp:page:readiness_run"
  | "gmp:page:preview_unapproved";

type PagePermissions = {
  canCreatePage: boolean;
  canEditPage: boolean;
  canArchivePage: boolean;
  canManageBrief: boolean;
  canManagePlan: boolean;
  canManageRelationships: boolean;
  canManageLinks: boolean;
  canReviewBriefOrPlan: boolean;
  canApproveBriefOrPlan: boolean;
  canRejectBriefOrPlan: boolean;
  canRunReadiness: boolean;
};

type ScanOperationType = "relationship_scan" | "link_scan" | "planning_health_scan" | "project_architecture_scan" | "dashboard_refresh";

export type GmpPageApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  pageRepository?: GmpPageRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
  pageServices?: GmpPageServices;
};

function deps(input?: GmpPageApiDependencies): Required<GmpPageApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const pageRepository = input?.pageRepository ?? createPrismaGmpPageRepository();
  const knowledgeRepository = input?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    pageRepository,
    knowledgeRepository,
    pageServices: input?.pageServices ?? createGmpPageServices({ pageRepository, knowledgeRepository }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function parsePageLifecycleState(value: unknown): GmpPageLifecycleState | undefined {
  if (value === "DRAFT" || value === "IN_REVIEW" || value === "APPROVED" || value === "ARCHIVED") {
    return value;
  }

  return undefined;
}

function parsePageArtifactStatus(value: unknown): GmpPageArtifactStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  for (const status of gmpPageArtifactStatuses) {
    if (status === value) {
      return status;
    }
  }

  return undefined;
}

type PageAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: {
  actionId: PageAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpPageApiDependencies;
}): Promise<PageAuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId: input.workspaceId,
      moduleId: DEFAULT_MODULE_ID,
      route: input.route,
    },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) } as const;
  }

  return { subject } as const;
}

async function can(input: {
  actionId: PageAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpPageApiDependencies;
}): Promise<boolean> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) {
    return false;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId: input.workspaceId,
      moduleId: DEFAULT_MODULE_ID,
      route: input.route,
    },
  });

  return decision.allowed;
}

async function collectPagePermissions(workspaceId: string, dependencies?: GmpPageApiDependencies): Promise<PagePermissions> {
  return {
    canCreatePage: await can({ actionId: "gmp:page:create", workspaceId, route: "/api/gmp/projects/[id]/pages", dependencies }),
    canEditPage: await can({ actionId: "gmp:page:edit", workspaceId, route: "/api/gmp/pages/[pageId]", dependencies }),
    canArchivePage: await can({ actionId: "gmp:page:archive", workspaceId, route: "/api/gmp/pages/[pageId]", dependencies }),
    canManageBrief: await can({ actionId: "gmp:page:brief_manage", workspaceId, route: "/api/gmp/pages/[pageId]/briefs", dependencies }),
    canManagePlan: await can({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/pages/[pageId]/plans/generate", dependencies }),
    canManageRelationships: await can({ actionId: "gmp:page:relationships_manage", workspaceId, route: "/api/gmp/pages/[pageId]/relationships", dependencies }),
    canManageLinks: await can({ actionId: "gmp:page:links_manage", workspaceId, route: "/api/gmp/pages/[pageId]/internal-links", dependencies }),
    canReviewBriefOrPlan: await can({ actionId: "gmp:page:review_submit", workspaceId, route: "/api/gmp/page-briefs/[briefId]/review", dependencies }),
    canApproveBriefOrPlan: await can({ actionId: "gmp:page:approve", workspaceId, route: "/api/gmp/page-briefs/[briefId]/approve", dependencies }),
    canRejectBriefOrPlan: await can({ actionId: "gmp:page:reject", workspaceId, route: "/api/gmp/page-briefs/[briefId]/reject", dependencies }),
    canRunReadiness: await can({ actionId: "gmp:page:readiness_run", workspaceId, route: "/api/gmp/pages/[pageId]/readiness/run", dependencies }),
  };
}

async function ensureProject(projectId: string, workspaceId: string, dependencies?: GmpPageApiDependencies): Promise<GmpProject | null> {
  const d = deps(dependencies);
  const project = await d.projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }
  return project;
}

async function ensureProjectSite(projectId: string, siteId: string, dependencies?: GmpPageApiDependencies): Promise<GmpSite | null> {
  const d = deps(dependencies);
  const sites = await d.projectRepository.listSitesForProject(projectId);
  return sites.find((site) => site.siteId === siteId) ?? null;
}

async function ensurePage(pageId: string, workspaceId: string, dependencies?: GmpPageApiDependencies) {
  const d = deps(dependencies);
  const page = await d.pageRepository.getPageById(pageId);
  if (!page) return null;
  const project = await d.projectRepository.getProjectById(page.projectId);
  if (!project || project.workspaceId !== workspaceId) return null;
  return page;
}

function briefSnapshot(brief: GmpPageBrief): Record<string, unknown> {
  return {
    ...brief,
  };
}

function planSnapshot(plan: GmpContentPlan): Record<string, unknown> {
  return {
    ...plan,
  };
}

function createScanExecution(projectId: string, operationType: ScanOperationType, actorId: string, pageId?: string) {
  const runtime = getGenesisOrchestrationRuntime();
  const execution = runtime.createExecution({
    executionType: "gmp_page_operation",
    workspaceId: DEFAULT_WORKSPACE_ID,
    moduleId: DEFAULT_MODULE_ID,
    jobType: "PAGE_GENERATION",
    executionClass: "AUTOMATED",
    priority: "NORMAL",
    input: { projectId, operationType, pageId },
    correlationId: `${projectId}:${operationType}:${Date.now()}`,
  });

  runtime.syncGlwExecutionState({
    jobId: execution.jobId ?? `gmp_page_${execution.executionId}`,
    status: "RUNNING",
    correlationId: execution.correlationId,
    result: { actorId, pageId, operationType },
  });

  return {
    executionId: execution.executionId,
    createdAt: execution.timing.createdAt,
    operationType,
  };
}

async function collectRecentScanExecutions(workspaceId: string, projectId: string, operationTypes: ScanOperationType[]): Promise<GmpHealthExecutionReference[]> {
  const runtime = getGenesisOrchestrationRuntime();
  const operations = await runtime.buildOperationsSnapshot(workspaceId, getGenesisEventStore());
  return operations.executions
    .filter((execution) => {
      const input = execution.input as Record<string, unknown> | undefined;
      return input?.projectId === projectId && typeof input?.operationType === "string" && operationTypes.includes(input.operationType as ScanOperationType);
    })
    .slice(0, 5)
    .map((execution) => ({
      executionId: execution.executionId,
      status: execution.status,
      operationType: typeof execution.input?.operationType === "string" ? execution.input.operationType : undefined,
      createdAt: execution.timing.createdAt,
      projectId,
      pageId: typeof execution.input?.pageId === "string" ? execution.input.pageId : undefined,
    }));
}

export async function handleListPages(request: Request, projectId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/projects/[id]/pages", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const pages = await d.pageRepository.listPagesForProject(projectId, false);
  const permissions = await collectPagePermissions(workspaceId, dependencies);

  return json({ pages, permissions });
}

export async function handleCreatePage(request: Request, projectId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:create", workspaceId, route: "/api/gmp/projects/[id]/pages", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validated = validatePageCreateInput(input);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const site = await ensureProjectSite(project.projectId, validated.value.siteId, dependencies);
  if (!site) return json({ error: "Site not found in project." }, 404);

  const d = deps(dependencies);
  const page = buildPage({
    projectId,
    siteId: validated.value.siteId,
    actorId: access.subject.actorId,
    pageType: validated.value.pageType,
    name: validated.value.name,
    slug: validated.value.slug,
    title: validated.value.title,
    locale: validated.value.locale,
    language: validated.value.language,
    metadata: validated.value.metadata,
  });

  const created = await d.pageRepository.createPage(page);
  return json({ page: created }, 201);
}

export async function handleGetPage(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const [briefs, plans, readiness, relationships, internalLinks] = await Promise.all([
    d.pageRepository.listBriefsForPage(pageId),
    d.pageRepository.listContentPlansForPage(pageId),
    d.pageRepository.getLatestReadinessAssessment(pageId),
    d.pageRepository.listRelationshipsForPage(pageId),
    d.pageRepository.listInternalLinksForPage(pageId),
  ]);
  const permissions = await collectPagePermissions(workspaceId, dependencies);

  return json({ page, briefs, plans, readiness, relationships, internalLinks, permissions });
}

export async function handleUpdatePage(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:edit", workspaceId, route: "/api/gmp/pages/[pageId]", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: "Request body must be valid JSON." }, 400);

  const d = deps(dependencies);
  const updated = await d.pageRepository.updatePage(pageId, {
    name: typeof input.name === "string" ? input.name : undefined,
    title: typeof input.title === "string" ? input.title : undefined,
    summary: typeof input.summary === "string" ? input.summary : undefined,
    purpose: typeof input.purpose === "string" ? input.purpose : undefined,
    primaryObjective: typeof input.primaryObjective === "string" ? input.primaryObjective : undefined,
    secondaryObjectives: Array.isArray(input.secondaryObjectives) ? input.secondaryObjectives.map(String) : undefined,
    lifecycleState: parsePageLifecycleState(input.lifecycleState),
    contentState: typeof input.contentState === "string" ? input.contentState : undefined,
    seoState: typeof input.seoState === "string" ? input.seoState : undefined,
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
  });

  if (!updated) return json({ error: "Page not found." }, 404);
  return json({ page: updated });
}

export async function handleArchivePage(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:archive", workspaceId, route: "/api/gmp/pages/[pageId]", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const updated = await d.pageRepository.updatePage(pageId, {
    archivedAt: new Date().toISOString(),
    lifecycleState: "ARCHIVED",
    contentState: "ARCHIVED",
  });

  return json({ page: updated });
}

export async function handleListPageBriefs(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/briefs", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const briefs = await d.pageRepository.listBriefsForPage(pageId);
  return json({ briefs });
}

export async function handleGetPageBrief(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/page-briefs/[briefId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const brief = await d.pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const versions = await d.pageRepository.listBriefVersions(briefId);
  return json({ brief, versions });
}

export async function handleUpdatePageBrief(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:brief_manage", workspaceId, route: "/api/gmp/page-briefs/[briefId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const brief = await d.pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const page = await ensurePage(brief.pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);

  if (brief.status === "APPROVED" && body.supersede !== true) {
    return json({ error: "Approved briefs are immutable. Supersede the brief to edit it." }, 409);
  }

  const patch = {
    ...body,
    status: parsePageArtifactStatus(body.status),
    approvedAt: typeof body.approvedAt === "string" ? body.approvedAt : undefined,
    approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  };

  if (brief.status === "APPROVED" && body.supersede === true) {
    const nextBrief = await d.pageRepository.createBrief({
      ...brief,
      status: "DRAFT",
      approvedAt: null,
      approvedBy: null,
      archivedAt: null,
      metadata: { ...(brief.metadata ?? {}), supersededFromBriefId: brief.briefId },
    });
    await d.pageRepository.updatePage(page.pageId, { currentBriefId: nextBrief.briefId });
    return json({ brief: nextBrief }, 201);
  }

  await d.pageRepository.createBriefVersion({
    briefId,
    versionNumber: brief.briefVersion + 1,
    previousValue: briefSnapshot(brief),
    newValue: { ...briefSnapshot(brief), ...patch },
    changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
    changedBy: access.subject.actorId,
  });

  const updated = await d.pageRepository.updateBrief(briefId, patch);
  return json({ brief: updated });
}

export async function handleListPageBriefVersions(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/page-briefs/[briefId]/versions", dependencies });
  if ("error" in access) return access.error;

  const brief = await deps(dependencies).pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const versions = await deps(dependencies).pageRepository.listBriefVersions(briefId);
  return json({ versions });
}

export async function handleReviewPageBrief(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:review_submit", workspaceId, route: "/api/gmp/page-briefs/[briefId]/review", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const brief = await d.pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const updated = await d.pageRepository.updateBrief(briefId, { status: "REQUIRES_REVIEW" });
  return json({ brief: updated });
}

export async function handleApprovePageBrief(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:approve", workspaceId, route: "/api/gmp/page-briefs/[briefId]/approve", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const brief = await d.pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const updated = await d.pageRepository.updateBrief(briefId, {
    status: "APPROVED",
    approvedAt: new Date().toISOString(),
    approvedBy: access.subject.actorId,
  });
  return json({ brief: updated });
}

export async function handleRejectPageBrief(request: Request, briefId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:reject", workspaceId, route: "/api/gmp/page-briefs/[briefId]/reject", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const brief = await d.pageRepository.getBriefById(briefId);
  if (!brief) return json({ error: "Brief not found." }, 404);

  const updated = await d.pageRepository.updateBrief(briefId, { status: "REJECTED" });
  return json({ brief: updated });
}

export async function handleGetContentPlan(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/content-plans/[planId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const plan = await d.pageRepository.getContentPlanById(planId);
  if (!plan) return json({ error: "Content plan not found." }, 404);

  const sections = await d.pageRepository.listSectionsForPlan(planId);
  const versions = await d.pageRepository.listContentPlanVersions(planId);
  return json({ plan, sections, versions });
}

export async function handleUpdateContentPlan(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/content-plans/[planId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const plan = await d.pageRepository.getContentPlanById(planId);
  if (!plan) return json({ error: "Content plan not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);

  if (plan.status === "APPROVED" && body.supersede !== true) {
    return json({ error: "Approved plans are immutable. Supersede the plan to edit it." }, 409);
  }

  await d.pageRepository.createContentPlanVersion({
    contentPlanId: planId,
    versionNumber: plan.planVersion + 1,
    previousValue: planSnapshot(plan),
    newValue: { ...planSnapshot(plan), ...body },
    changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
    changedBy: access.subject.actorId,
  });

  const updated = await d.pageRepository.updateContentPlan(planId, {
    status: parsePageArtifactStatus(body.status),
    planningModelVersion: typeof body.planningModelVersion === "string" ? body.planningModelVersion : undefined,
    readingLevel: typeof body.readingLevel === "string" ? body.readingLevel : undefined,
    approvedAt: typeof body.approvedAt === "string" ? body.approvedAt : undefined,
    approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ plan: updated });
}

export async function handleListContentPlanVersions(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/content-plans/[planId]/versions", dependencies });
  if ("error" in access) return access.error;

  const versions = await deps(dependencies).pageRepository.listContentPlanVersions(planId);
  return json({ versions });
}

export async function handleReviewContentPlan(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:review_submit", workspaceId, route: "/api/gmp/content-plans/[planId]/review", dependencies });
  if ("error" in access) return access.error;
  const plan = await deps(dependencies).pageRepository.getContentPlanById(planId);
  if (!plan) return json({ error: "Content plan not found." }, 404);
  const updated = await deps(dependencies).pageRepository.updateContentPlan(planId, { status: "REQUIRES_REVIEW" });
  return json({ plan: updated });
}

export async function handleApproveContentPlan(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:approve", workspaceId, route: "/api/gmp/content-plans/[planId]/approve", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).pageRepository.updateContentPlan(planId, { status: "APPROVED", approvedAt: new Date().toISOString(), approvedBy: access.subject.actorId });
  return json({ plan: updated });
}

export async function handleRejectContentPlan(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:reject", workspaceId, route: "/api/gmp/content-plans/[planId]/reject", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).pageRepository.updateContentPlan(planId, { status: "REJECTED" });
  return json({ plan: updated });
}

export async function handleGetContentPlanSections(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/content-plans/[planId]/sections", dependencies });
  if ("error" in access) return access.error;
  const sections = await deps(dependencies).pageRepository.listSectionsForPlan(planId);
  return json({ sections });
}

export async function handleCreateSection(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/content-plans/[planId]/sections", dependencies });
  if ("error" in access) return access.error;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: "Request body must be valid JSON." }, 400);
  const plan = await deps(dependencies).pageRepository.getContentPlanById(planId);
  if (!plan) return json({ error: "Content plan not found." }, 404);
  const sections = await deps(dependencies).pageRepository.replaceSectionsForPlan(planId, plan.pageId, plan.projectId, [{
    projectId: plan.projectId,
    pageId: plan.pageId,
    contentPlanId: planId,
    parentSectionId: typeof input.parentSectionId === "string" ? input.parentSectionId : undefined,
    sectionType: input.sectionType as GmpPageSection["sectionType"],
    sectionKey: String(input.sectionKey ?? `section_${Date.now()}`),
    position: typeof input.position === "number" ? input.position : 1,
    headingLevel: typeof input.headingLevel === "number" ? input.headingLevel : 2,
    workingHeading: typeof input.workingHeading === "string" ? input.workingHeading : undefined,
    purpose: typeof input.purpose === "string" ? input.purpose : undefined,
    audienceNeed: typeof input.audienceNeed === "string" ? input.audienceNeed : undefined,
    requiredKnowledgeRecords: Array.isArray(input.requiredKnowledgeRecords) ? input.requiredKnowledgeRecords.map(String) : [],
    requiredClaims: Array.isArray(input.requiredClaims) ? input.requiredClaims.map(String) : [],
    requiredEvidence: Array.isArray(input.requiredEvidence) ? input.requiredEvidence.map(String) : [],
    requiredProducts: Array.isArray(input.requiredProducts) ? input.requiredProducts.map(String) : [],
    requiredServices: Array.isArray(input.requiredServices) ? input.requiredServices.map(String) : [],
    requiredSpecifications: Array.isArray(input.requiredSpecifications) ? input.requiredSpecifications.map(String) : [],
    requiredFaqs: Array.isArray(input.requiredFaqs) ? input.requiredFaqs.map(String) : [],
    targetWordRange: typeof input.targetWordRange === "object" && input.targetWordRange !== null ? input.targetWordRange as { min: number; max: number } : { min: 100, max: 180 },
    ctaType: typeof input.ctaType === "string" ? input.ctaType : undefined,
    mediaRequirement: typeof input.mediaRequirement === "object" && input.mediaRequirement !== null ? input.mediaRequirement as Record<string, unknown> : {},
    internalLinkRequirement: typeof input.internalLinkRequirement === "object" && input.internalLinkRequirement !== null ? input.internalLinkRequirement as Record<string, unknown> : {},
    structuredDataContribution: typeof input.structuredDataContribution === "object" && input.structuredDataContribution !== null ? input.structuredDataContribution as Record<string, unknown> : {},
    optional: Boolean(input.optional),
    status: typeof input.status === "string" ? input.status : "PLANNED",
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
  }]);
  return json({ sections }, 201);
}

export async function handlePatchSection(request: Request, sectionId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/page-sections/[sectionId]", dependencies });
  if ("error" in access) return access.error;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: "Request body must be valid JSON." }, 400);
  const updated = await deps(dependencies).pageRepository.updateSection(sectionId, {
    workingHeading: typeof input.workingHeading === "string" ? input.workingHeading : undefined,
    purpose: typeof input.purpose === "string" ? input.purpose : undefined,
    audienceNeed: typeof input.audienceNeed === "string" ? input.audienceNeed : undefined,
    optional: typeof input.optional === "boolean" ? input.optional : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
  });
  if (!updated) return json({ error: "Section not found." }, 404);
  return json({ section: updated });
}

export async function handleDeleteSection(request: Request, sectionId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/page-sections/[sectionId]", dependencies });
  if ("error" in access) return access.error;
  const deleted = await deps(dependencies).pageRepository.deleteSection(sectionId);
  if (!deleted) return json({ error: "Section not found." }, 404);
  return json({ ok: true });
}

export async function handleReorderSections(request: Request, planId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/content-plans/[planId]/sections/reorder", dependencies });
  if ("error" in access) return access.error;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || !Array.isArray(input.orderedSectionIds)) return json({ error: "orderedSectionIds is required." }, 400);
  const plan = await deps(dependencies).pageRepository.getContentPlanById(planId);
  if (!plan) return json({ error: "Content plan not found." }, 404);
  const sections = await deps(dependencies).pageRepository.reorderSections(planId, input.orderedSectionIds.map(String));
  return json({ sections });
}

export async function handleDeleteRelationship(request: Request, relationshipId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:relationships_manage", workspaceId, route: "/api/gmp/page-relationships/[relationshipId]", dependencies });
  if ("error" in access) return access.error;
  const deleted = await deps(dependencies).pageRepository.deleteRelationship(relationshipId);
  if (!deleted) return json({ error: "Relationship not found." }, 404);
  return json({ ok: true });
}

export async function handlePatchInternalLink(request: Request, linkId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:links_manage", workspaceId, route: "/api/gmp/internal-links/[linkId]", dependencies });
  if ("error" in access) return access.error;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: "Request body must be valid JSON." }, 400);
  const updated = await deps(dependencies).pageRepository.updateInternalLink(linkId, {
    anchorTextGuidance: typeof input.anchorTextGuidance === "string" ? input.anchorTextGuidance : undefined,
    requirementLevel: typeof input.requirementLevel === "string" ? input.requirementLevel : undefined,
    sectionPlacement: typeof input.sectionPlacement === "string" ? input.sectionPlacement : undefined,
    priority: typeof input.priority === "number" ? input.priority : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    reason: typeof input.reason === "string" ? input.reason : undefined,
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
  });
  if (!updated) return json({ error: "Link not found." }, 404);
  return json({ link: updated });
}

export async function handleDeleteInternalLink(request: Request, linkId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:links_manage", workspaceId, route: "/api/gmp/internal-links/[linkId]", dependencies });
  if ("error" in access) return access.error;
  const deleted = await deps(dependencies).pageRepository.deleteInternalLink(linkId);
  if (!deleted) return json({ error: "Link not found." }, 404);
  return json({ ok: true });
}

export async function handleCreatePageBrief(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:brief_manage", workspaceId, route: "/api/gmp/pages/[pageId]/briefs", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validated = validatePageBriefInput(input);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const d = deps(dependencies);
  const brief = await d.pageRepository.createBrief({
    projectId: page.projectId,
    pageId: page.pageId,
    status: "DRAFT",
    secondaryTopics: validated.value.secondaryTopics ?? [],
    secondaryKeywords: validated.value.secondaryKeywords ?? [],
    requiredClaims: validated.value.requiredClaims ?? [],
    requiredProofPoints: validated.value.requiredProofPoints ?? [],
    requiredProductsOrServices: validated.value.requiredProductsOrServices ?? [],
    requiredApplications: validated.value.requiredApplications ?? [],
    requiredIndustries: validated.value.requiredIndustries ?? [],
    requiredTechnicalSpecifications: validated.value.requiredTechnicalSpecifications ?? [],
    requiredFaqs: validated.value.requiredFaqs ?? [],
    restrictedMessaging: validated.value.restrictedMessaging ?? [],
    competitorContext: validated.value.competitorContext ?? {},
    evidenceRequirements: validated.value.evidenceRequirements ?? [],
    knowledgeRecordReferences: validated.value.knowledgeRecordReferences ?? [],
    sourceReferences: validated.value.sourceReferences ?? [],
    purpose: validated.value.purpose,
    audience: validated.value.audience,
    userNeed: validated.value.userNeed,
    businessGoal: validated.value.businessGoal,
    primaryTopic: validated.value.primaryTopic,
    primaryKeyword: validated.value.primaryKeyword,
    searchIntent: validated.value.searchIntent,
    funnelStage: validated.value.funnelStage,
    valueProposition: validated.value.valueProposition,
    conversionGoal: validated.value.conversionGoal,
    primaryCta: validated.value.primaryCta,
    secondaryCta: validated.value.secondaryCta,
    toneGuidance: validated.value.toneGuidance,
    metadata: validated.value.metadata,
    approvedAt: null,
    approvedBy: null,
    archivedAt: null,
  });

  await d.pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });
  return json({ brief }, 201);
}

export async function handleGeneratePagePlan(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:plan_manage", workspaceId, route: "/api/gmp/pages/[pageId]/plans/generate", dependencies });
  if ("error" in access) return access.error;

  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const result = await deps(dependencies).pageServices.generatePlanForPage({
    pageId,
    actorId: access.subject.actorId,
    briefId: typeof input.briefId === "string" ? input.briefId : undefined,
  });

  if (!result) return json({ error: "Unable to generate plan. Ensure page and brief exist." }, 400);
  return json(result, 201);
}

export async function handleGetPagePlan(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/plans", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const plans = await d.pageRepository.listContentPlansForPage(pageId);
  const current = page.currentContentPlanId ? await d.pageRepository.getContentPlanById(page.currentContentPlanId) : null;
  const sections = current ? await d.pageRepository.listSectionsForPlan(current.contentPlanId) : [];
  const versions = current ? await d.pageRepository.listContentPlanVersions(current.contentPlanId) : [];
  const knowledgeReferences = await d.pageRepository.listKnowledgeReferencesForPage(pageId);
  const sourceReferences = await d.pageRepository.listSourceReferencesForPage(pageId);

  return json({ plans, current, sections, versions, knowledgeReferences, sourceReferences });
}

export async function handleRunPageReadiness(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:readiness_run", workspaceId, route: "/api/gmp/pages/[pageId]/readiness/run", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const readiness = await deps(dependencies).pageServices.runReadinessAssessment(pageId, access.subject.actorId);
  if (!readiness) return json({ error: "Unable to run readiness." }, 400);

  return json({ readiness }, 201);
}

export async function handleGetPageReadiness(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/readiness", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const readiness = await deps(dependencies).pageRepository.getLatestReadinessAssessment(pageId);
  return json({ readiness });
}

export async function handleGetPageHealth(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/health", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [graph, links, report] = await Promise.all([
    buildPageGraph(page.projectId, d.pageRepository),
    buildPageLinkSummary(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, pageId: page.pageId, repository: d.pageRepository, executions: await collectRecentScanExecutions(workspaceId, page.projectId, ["relationship_scan", "link_scan", "planning_health_scan", "project_architecture_scan", "dashboard_refresh"]) }),
  ]);
  return json({ graph, links, report });
}

export async function handleGetRelationshipHealth(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/relationships/health", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [graph, report] = await Promise.all([
    buildPageGraph(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, pageId: page.pageId, repository: d.pageRepository, executions: await collectRecentScanExecutions(workspaceId, page.projectId, ["relationship_scan"]) }),
  ]);
  return json({ graph, report });
}

export async function handleRunRelationshipScan(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:relationships_manage", workspaceId, route: "/api/gmp/pages/[pageId]/relationships/scan", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [graph, report] = await Promise.all([
    buildPageGraph(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, pageId: page.pageId, repository: d.pageRepository }),
  ]);
  const execution = createScanExecution(page.projectId, "relationship_scan", access.subject.actorId, page.pageId);
  return json({ graph, report, execution }, 201);
}

export async function handleGetInternalLinkHealth(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/internal-links/health", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [links, report] = await Promise.all([
    buildPageLinkSummary(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, pageId: page.pageId, repository: d.pageRepository, executions: await collectRecentScanExecutions(workspaceId, page.projectId, ["link_scan"]) }),
  ]);
  return json({ links, report });
}

export async function handleRunInternalLinkScan(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:links_manage", workspaceId, route: "/api/gmp/pages/[pageId]/internal-links/scan", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [links, report] = await Promise.all([
    buildPageLinkSummary(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, pageId: page.pageId, repository: d.pageRepository }),
  ]);
  const execution = createScanExecution(page.projectId, "link_scan", access.subject.actorId, page.pageId);
  return json({ links, report, execution }, 201);
}

export async function handleGetProjectPageArchitectureHealth(request: Request, projectId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/projects/[id]/page-architecture/health", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const report = await buildPageHealthReport({ projectId, repository: d.pageRepository, executions: await collectRecentScanExecutions(workspaceId, projectId, ["project_architecture_scan", "planning_health_scan", "dashboard_refresh"]) });
  return json({ report });
}

export async function handleRunProjectPageArchitectureScan(request: Request, projectId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:readiness_run", workspaceId, route: "/api/gmp/projects/[id]/page-architecture/scan", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const report = await buildPageHealthReport({ projectId, repository: d.pageRepository, executions: await collectRecentScanExecutions(workspaceId, projectId, ["project_architecture_scan", "planning_health_scan", "dashboard_refresh"]) });
  const execution = createScanExecution(projectId, "project_architecture_scan", access.subject.actorId);
  return json({ report, execution }, 201);
}

export async function handleRunPageArchitectureScan(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:readiness_run", workspaceId, route: "/api/gmp/pages/[pageId]/health", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const d = deps(dependencies);
  const [graph, links, report] = await Promise.all([
    buildPageGraph(page.projectId, d.pageRepository),
    buildPageLinkSummary(page.projectId, d.pageRepository),
    buildPageHealthReport({ projectId: page.projectId, repository: d.pageRepository }),
  ]);

  createScanExecution(page.projectId, "relationship_scan", access.subject.actorId, page.pageId);
  createScanExecution(page.projectId, "link_scan", access.subject.actorId, page.pageId);
  createScanExecution(page.projectId, "planning_health_scan", access.subject.actorId, page.pageId);
  createScanExecution(page.projectId, "dashboard_refresh", access.subject.actorId, page.pageId);

  return json({ graph, links, report, execution: createScanExecution(page.projectId, "project_architecture_scan", access.subject.actorId, page.pageId) }, 201);
}

export async function handleGetProjectPageHealth(request: Request, projectId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/projects/[id]/pages/health", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const report = await buildPageHealthReport({ projectId, repository: d.pageRepository });
  return json({ report });
}

export async function handleUpsertPageRelationship(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:relationships_manage", workspaceId, route: "/api/gmp/pages/[pageId]/relationships", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.targetPageId !== "string" || typeof input.relationshipType !== "string") {
    return json({ error: "targetPageId and relationshipType are required." }, 400);
  }

  const target = await ensurePage(input.targetPageId, workspaceId, dependencies);
  if (!target || target.projectId !== page.projectId) {
    return json({ error: "Target page not found in this project." }, 404);
  }

  const relationship = await d.pageRepository.upsertRelationship({
    projectId: page.projectId,
    sourcePageId: page.pageId,
    targetPageId: target.pageId,
    relationshipType: input.relationshipType,
    priority: typeof input.priority === "number" ? input.priority : 50,
    reason: typeof input.reason === "string" ? input.reason : undefined,
    status: typeof input.status === "string" ? input.status : "ACTIVE",
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
  });

  return json({ relationship });
}

export async function handleListPageRelationships(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/relationships", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const relationships = await deps(dependencies).pageRepository.listRelationshipsForPage(pageId);
  return json({ relationships });
}

export async function handleListPageInternalLinks(request: Request, pageId: string, dependencies?: GmpPageApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:page:view", workspaceId, route: "/api/gmp/pages/[pageId]/internal-links", dependencies });
  if ("error" in access) return access.error;

  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const internalLinks = await deps(dependencies).pageRepository.listInternalLinksForPage(pageId);
  return json({ internalLinks });
}
