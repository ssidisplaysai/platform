import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import {
  createGmpProject,
  gmpPublishingPlatforms,
  gmpSiteEnvironments,
  validateProjectInput,
  validateSiteInput,
  type GmpBrandProfile,
  type GmpProject,
  type GmpSite,
  type GmpPublishingConnection,
} from "./models";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";
import { createPrismaGmpContentRepository, type GmpContentRepository } from "./content-repository";
import { createGmpContentServices, type GmpContentServices } from "./content-services";
import { createPrismaGmpPublishingRepository, type GmpPublishingRepository } from "./publishing-repository";
import { createGmpPublishingServices, type GmpPublishingServices } from "./publishing-services";
import { buildPageHealthReport } from "./page-health-service";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "glw.core";
const gmpProjectStatuses: GmpProject["status"][] = ["ACTIVE", "PAUSED", "ARCHIVED"];
const gmpProjectLifecycleStates: GmpProject["lifecycleState"][] = ["ONBOARDING", "LIVE", "MAINTENANCE", "SUNSET"];
const gmpSitePublishingStatuses: GmpSite["publishingStatus"][] = ["CONNECTED", "DISCONNECTED", "DEGRADED"];
const gmpAuthenticationMethods: GmpSite["authenticationMethod"][] = ["oauth2", "api_key", "basic", "token", "custom"];
const gmpConnectionStatuses: GmpSite["connectionStatus"][] = ["HEALTHY", "DEGRADED", "OFFLINE"];
const gmpConnectionPublishingStatuses: GmpPublishingConnection["publishingStatus"][] = ["READY", "LIMITED", "DISABLED"];

function parseStringEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return allowed.includes(value as T) ? (value as T) : undefined;
}

function parseLowerStringEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : undefined;
}

export type GmpApiDependencies = {
  repository?: GmpRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
  pageRepository?: GmpPageRepository;
  contentRepository?: GmpContentRepository;
  contentServices?: GmpContentServices;
  publishingRepository?: GmpPublishingRepository;
  publishingServices?: GmpPublishingServices;
  sessionLoader?: typeof getGlwSession;
};

function getDependencies(dependencies?: GmpApiDependencies): {
  repository: GmpRepository;
  knowledgeRepository: GmpKnowledgeRepository;
  pageRepository: GmpPageRepository;
  contentRepository: GmpContentRepository;
  contentServices: GmpContentServices;
  publishingRepository: GmpPublishingRepository;
  publishingServices: GmpPublishingServices;
  sessionLoader: typeof getGlwSession;
} {
  const repository = dependencies?.repository ?? createPrismaGmpRepository();
  const knowledgeRepository = dependencies?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();
  const pageRepository = dependencies?.pageRepository ?? createPrismaGmpPageRepository();
  const contentRepository = dependencies?.contentRepository ?? createPrismaGmpContentRepository();
  const publishingRepository = dependencies?.publishingRepository ?? createPrismaGmpPublishingRepository();
  return {
    repository,
    knowledgeRepository,
    pageRepository,
    contentRepository,
    contentServices: dependencies?.contentServices ?? createGmpContentServices({ projectRepository: repository, pageRepository, knowledgeRepository, contentRepository }),
    publishingRepository,
    publishingServices: dependencies?.publishingServices ?? createGmpPublishingServices({ projectRepository: repository, pageRepository, contentRepository, publishingRepository }),
    sessionLoader: dependencies?.sessionLoader ?? getGlwSession,
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function unauthorized(): NextResponse {
  return json({ error: "GLW session is required." }, 401);
}

function forbidden(reason: string): NextResponse {
  return json({ error: reason }, 403);
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter((entry) => entry.trim().length > 0) : [];
}

type GmpAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorizeGmpAction(input: {
  actionId: "gmp:project:view" | "gmp:project:manage";
  workspaceId: string;
  dependencies?: GmpApiDependencies;
  route?: string;
}): Promise<GmpAuthorizeResult> {
  const { sessionLoader } = getDependencies(input.dependencies);
  const session = await sessionLoader();
  if (!session) {
    return { error: unauthorized() } as const;
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
    return { error: forbidden(decision.reason) } as const;
  }

  return { subject } as const;
}

async function ensureProjectInWorkspace(projectId: string, workspaceId: string, dependencies?: GmpApiDependencies): Promise<GmpProject | null> {
  const { repository } = getDependencies(dependencies);
  const project = await repository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }

  return project;
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

export async function handleListProjects(request: Request, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/projects" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const projects = await repository.listProjects(workspaceId);
  return json({ projects });
}

export async function handleCreateProject(request: Request, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/projects" });
  if ("error" in access) {
    return access.error;
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validation = validateProjectInput(body);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  const { repository } = getDependencies(dependencies);
  const existing = await repository.getProjectBySlug(workspaceId, validation.value.slug ?? "");
  if (existing && validation.value.slug) {
    return json({ error: "A project with this slug already exists in this workspace." }, 409);
  }

  const project = createGmpProject({
    ...validation.value,
    workspaceId,
    ownerActorId: access.subject.actorId,
  });

  const created = await repository.createProject(project);
  return json({ project: created }, 201);
}

export async function handleGetProject(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/projects/[id]" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const { repository } = getDependencies(dependencies);
  const brandProfile = await repository.getBrandProfileByProjectId(project.projectId);
  const sites = await repository.listSitesForProject(project.projectId);

  return json({ project, brandProfile, sites });
}

export async function handleUpdateProject(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/projects/[id]" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const { repository } = getDependencies(dependencies);
  const updated = await repository.updateProject(projectId, {
    name: typeof body.name === "string" ? body.name : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    organization: typeof body.organization === "string" ? body.organization : undefined,
    status: parseStringEnum(body.status, gmpProjectStatuses),
    lifecycleState: parseStringEnum(body.lifecycleState, gmpProjectLifecycleStates),
    defaultLanguage: typeof body.defaultLanguage === "string" ? body.defaultLanguage : undefined,
    defaultLocale: typeof body.defaultLocale === "string" ? body.defaultLocale : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ project: updated });
}

export async function handleArchiveProject(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/projects/[id]/archive" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const { repository } = getDependencies(dependencies);
  const archived = await repository.archiveProject(projectId);
  return json({ project: archived });
}

export async function handleListSites(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/projects/[id]/sites" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const { repository } = getDependencies(dependencies);
  const sites = await repository.listSitesForProject(projectId);
  return json({ sites });
}

export async function handleCreateSite(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/projects/[id]/sites" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const validation = validateSiteInput({ ...body, projectId });
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  const { repository } = getDependencies(dependencies);
  const site = await repository.createSite(validation.value);
  return json({ site }, 201);
}

export async function handleUpdateSite(request: Request, siteId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/sites/[id]" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const site = await repository.getSiteById(siteId);
  if (!site) {
    return json({ error: "Site not found." }, 404);
  }

  const project = await ensureProjectInWorkspace(site.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Site not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const updated = await repository.updateSite(siteId, {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    primaryDomain: typeof body.primaryDomain === "string" ? body.primaryDomain : undefined,
    environment: parseLowerStringEnum(body.environment, gmpSiteEnvironments),
    publishingStatus: parseStringEnum(body.publishingStatus, gmpSitePublishingStatuses),
    publishingPlatform: parseLowerStringEnum(body.publishingPlatform, gmpPublishingPlatforms),
    authenticationMethod: parseStringEnum(body.authenticationMethod, gmpAuthenticationMethods),
    connectionStatus: parseStringEnum(body.connectionStatus, gmpConnectionStatuses),
    defaultLanguage: typeof body.defaultLanguage === "string" ? body.defaultLanguage : undefined,
    defaultTheme: typeof body.defaultTheme === "string" ? body.defaultTheme : undefined,
    publishingCapabilities: Array.isArray(body.publishingCapabilities) ? body.publishingCapabilities.map(String) : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ site: updated });
}

export async function handleArchiveSite(request: Request, siteId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/sites/[id]/archive" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const site = await repository.getSiteById(siteId);
  if (!site) {
    return json({ error: "Site not found." }, 404);
  }

  const project = await ensureProjectInWorkspace(site.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Site not found." }, 404);
  }

  const archived = await repository.archiveSite(siteId);
  return json({ site: archived });
}

export async function handleGetBrandProfile(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/projects/[id]/brand-profile" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const { repository } = getDependencies(dependencies);
  const brandProfile = await repository.getBrandProfileByProjectId(projectId);
  return json({ brandProfile });
}

export async function handleUpsertBrandProfile(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/projects/[id]/brand-profile" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.companyName !== "string" || body.companyName.trim().length < 2) {
    return json({ error: "companyName is required." }, 400);
  }

  const { repository } = getDependencies(dependencies);
  const profile = await repository.upsertBrandProfile({
    projectId,
    companyName: body.companyName,
    tagline: typeof body.tagline === "string" ? body.tagline : undefined,
    mission: typeof body.mission === "string" ? body.mission : undefined,
    brandVoice: typeof body.brandVoice === "string" ? body.brandVoice : undefined,
    writingStyle: typeof body.writingStyle === "string" ? body.writingStyle : undefined,
    primaryAudience: typeof body.primaryAudience === "string" ? body.primaryAudience : undefined,
    secondaryAudience: typeof body.secondaryAudience === "string" ? body.secondaryAudience : undefined,
    primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
    secondaryColor: typeof body.secondaryColor === "string" ? body.secondaryColor : undefined,
    logoReferences: parseStringArray(body.logoReferences),
    typography: typeof body.typography === "object" && body.typography !== null ? body.typography as Record<string, unknown> : undefined,
    assetReferences: parseStringArray(body.assetReferences),
    socialLinks: Array.isArray(body.socialLinks)
      ? body.socialLinks
          .map((entry) => entry as Record<string, unknown>)
          .filter((entry) => typeof entry.platform === "string" && typeof entry.url === "string")
          .map((entry) => ({ platform: String(entry.platform), url: String(entry.url) }))
      : [],
    contactInformation: typeof body.contactInformation === "object" && body.contactInformation !== null
      ? body.contactInformation as GmpBrandProfile["contactInformation"]
      : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ brandProfile: profile });
}

export async function handleListConnections(request: Request, siteId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/sites/[id]/connections" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const site = await repository.getSiteById(siteId);
  if (!site) {
    return json({ error: "Site not found." }, 404);
  }

  const project = await ensureProjectInWorkspace(site.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Site not found." }, 404);
  }

  const connections = await repository.listPublishingConnectionsForSite(siteId);
  return json({ connections });
}

export async function handleCreateConnection(request: Request, siteId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/sites/[id]/connections" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const site = await repository.getSiteById(siteId);
  if (!site) {
    return json({ error: "Site not found." }, 404);
  }

  const project = await ensureProjectInWorkspace(site.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Site not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const provider = String(body.provider ?? "").toLowerCase();
  if (!gmpPublishingPlatforms.includes(provider as typeof gmpPublishingPlatforms[number])) {
    return json({ error: "Unsupported publishing provider." }, 400);
  }

  const environment = String(body.environment ?? "").toLowerCase();
  if (!gmpSiteEnvironments.includes(environment as typeof gmpSiteEnvironments[number])) {
    return json({ error: "Unsupported environment." }, 400);
  }

  const connection = await repository.createPublishingConnection({
    siteId,
    provider: provider as GmpPublishingConnection["provider"],
    environment: environment as GmpPublishingConnection["environment"],
    publishingStatus: parseStringEnum(body.publishingStatus, gmpConnectionPublishingStatuses) ?? "READY",
    authenticationMethod: parseStringEnum(body.authenticationMethod, gmpAuthenticationMethods) ?? "token",
    connectionStatus: parseStringEnum(body.connectionStatus, gmpConnectionStatuses) ?? "HEALTHY",
    publishingCapabilities: parseStringArray(body.publishingCapabilities),
    configuration: typeof body.configuration === "object" && body.configuration !== null ? body.configuration as Record<string, unknown> : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
    lastValidatedAt: new Date().toISOString(),
  });

  return json({ connection }, 201);
}

export async function handleUpdateConnection(request: Request, connectionId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/connections/[id]" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const connection = await repository.updatePublishingConnection(connectionId, {
    provider: parseLowerStringEnum(body.provider, gmpPublishingPlatforms),
    environment: parseLowerStringEnum(body.environment, gmpSiteEnvironments),
    publishingStatus: parseStringEnum(body.publishingStatus, gmpConnectionPublishingStatuses),
    authenticationMethod: parseStringEnum(body.authenticationMethod, gmpAuthenticationMethods),
    connectionStatus: parseStringEnum(body.connectionStatus, gmpConnectionStatuses),
    publishingCapabilities: Array.isArray(body.publishingCapabilities) ? body.publishingCapabilities.map(String) : undefined,
    configuration: typeof body.configuration === "object" && body.configuration !== null ? body.configuration as Record<string, unknown> : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
    lastValidatedAt: new Date().toISOString(),
  });

  if (!connection) {
    return json({ error: "Connection not found." }, 404);
  }

  return json({ connection });
}

export async function handleArchiveConnection(request: Request, connectionId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:manage", workspaceId, dependencies, route: "/api/gmp/connections/[id]/archive" });
  if ("error" in access) {
    return access.error;
  }

  const { repository } = getDependencies(dependencies);
  const connection = await repository.archivePublishingConnection(connectionId);
  if (!connection) {
    return json({ error: "Connection not found." }, 404);
  }

  return json({ connection });
}

export async function handleProjectDashboard(request: Request, projectId: string, dependencies?: GmpApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorizeGmpAction({ actionId: "gmp:project:view", workspaceId, dependencies, route: "/api/gmp/projects/[id]/dashboard" });
  if ("error" in access) {
    return access.error;
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const { repository, knowledgeRepository, pageRepository, contentRepository, contentServices, publishingServices } = getDependencies(dependencies);
  const [sites, brandProfile, envConfigs] = await Promise.all([
    repository.listSitesForProject(projectId),
    repository.getBrandProfileByProjectId(projectId),
    repository.listEnvironmentConfigsForProject(projectId),
  ]);
  const [knowledgeWorkspace, knowledgeRecords, knowledgeSources, knowledgeConflicts, knowledgeReviewQueue, latestCompleteness] = await Promise.all([
    knowledgeRepository.getWorkspaceByProjectId(projectId),
    knowledgeRepository.listRecords(projectId, { includeArchived: false }),
    knowledgeRepository.listSources(projectId),
    knowledgeRepository.listConflicts(projectId),
    knowledgeRepository.listReviewQueue(projectId),
    knowledgeRepository.getLatestCompletenessAssessment(projectId),
  ]);
  const pages = await pageRepository.listPagesForProject(projectId, true);
  const [pageDraftLists, eligibilityReports] = await Promise.all([
    Promise.all(pages.map((page) => contentRepository.listDraftsForPage(page.pageId))),
    Promise.all(pages.map((page) => contentServices.evaluateEligibility(page.pageId))),
  ]);

  const runtime = getGenesisOrchestrationRuntime();
  const operations = await runtime.buildOperationsSnapshot(workspaceId, getGenesisEventStore());
  const executions = operations.executions.filter((execution) => {
    const inInput = execution.input?.projectId === projectId;
    const inMetadata = typeof execution.metadata?.projectId === "string" && execution.metadata.projectId === projectId;
    const inContext = execution.context?.metadata && typeof execution.context.metadata.projectId === "string" && execution.context.metadata.projectId === projectId;
    return inInput || inMetadata || inContext;
  });

  const dashboardExecutions = executions.length > 0 ? executions : operations.executions;
  const pageHealthReport = await buildPageHealthReport({
    projectId,
    repository: pageRepository,
    executions: dashboardExecutions
      .filter((execution) => String(execution.executionType ?? "").includes("gmp_page"))
      .map((execution) => ({
        executionId: execution.executionId,
        status: execution.status,
        operationType: typeof execution.input?.operationType === "string" ? execution.input.operationType : undefined,
        createdAt: execution.timing.createdAt,
      })),
  });

  const pageMetrics = {
    totalPages: pages.length,
    pagesReady: pageHealthReport.pagesReady,
    pagesBlocked: pageHealthReport.pagesBlocked,
    missingBriefs: pageHealthReport.missingBriefs,
    missingPlans: pageHealthReport.missingPlans,
    missingSections: pageHealthReport.missingSections,
    averageReadiness: pageHealthReport.averageReadiness,
    knowledgeBlocked: pageHealthReport.knowledgeBlocked,
    evidenceMissing: pageHealthReport.evidenceMissing,
    conflictedKnowledge: pageHealthReport.conflictedKnowledge,
    expiredKnowledge: pageHealthReport.expiredKnowledge,
    relationshipHealth: pageHealthReport.relationshipHealth.score,
    relationshipBroken: pageHealthReport.relationshipBroken,
    circularReferences: pageHealthReport.circularReferences,
    weakClusters: pageHealthReport.weakClusters,
    weakPillars: pageHealthReport.weakPillars,
    disconnectedPages: pageHealthReport.disconnectedPages,
    orphanPages: pageHealthReport.orphanPages,
    missingInternalLinks: pageHealthReport.missingInternalLinks,
    brokenPlannedLinks: pageHealthReport.brokenPlannedLinks,
    duplicateCanonicals: pageHealthReport.duplicateCanonicals,
    missingMetadata: pageHealthReport.missingMetadata,
    recentPlanningExecutions: pageHealthReport.latestGopExecutions,
  };

  const publishingConnections = await Promise.all(sites.map((site) => repository.listPublishingConnectionsForSite(site.siteId)));
  const flattenedConnections = publishingConnections.flat();

  const executionSummary = {
    running: dashboardExecutions.filter((execution) => execution.status === "RUNNING" || execution.status === "DISPATCHED").length,
    completed: dashboardExecutions.filter((execution) => execution.status === "SUCCEEDED").length,
    failed: dashboardExecutions.filter((execution) => execution.status === "FAILED" || execution.status === "TIMED_OUT").length,
  };

  const drafts = pageDraftLists.flat();
  let pagePublications: Array<{ publicationRecordId: string; externalUrl: string; publishedStatus: string; verificationStatus: string; createdAt: string }> = [];
  let pagePackages: Array<{ packageStatus: string; releaseStatus: string; destinationId: string; publishingPackageId: string }> = [];
  let projectReleases: Array<{ releaseId: string; releaseType: string; releaseStatus: string; createdAt: string }> = [];
  let projectDestinations: Array<{ connectionStatus: string }> = [];

  try {
    pagePublications = (await Promise.all(pages.map((page) => publishingServices.listPublicationsForPage(page.pageId)))).flat();
    pagePackages = (await Promise.all(pages.map((page) => publishingServices.listPackagesForPage(page.pageId)))).flat();
    projectReleases = await publishingServices.listReleasesForProject(projectId);
    projectDestinations = await publishingServices.listDestinationsForProject(projectId);
  } catch {
    pagePublications = [];
    pagePackages = [];
    projectReleases = [];
    projectDestinations = [];
  }
  const draftSections = (await Promise.all(drafts.map((draft) => contentRepository.listSectionContentsForDraft(draft.contentDraftId)))).flat();
  const draftValidations = await Promise.all(drafts.map((draft) => contentRepository.getLatestContentValidation(draft.contentDraftId)));
  const sectionValidations = await Promise.all(draftSections.map((section) => contentRepository.getLatestSectionValidation(section.sectionContentId)));
  const contentExecutions = dashboardExecutions.filter((execution) => String(execution.executionType ?? "").includes("gmp_content"));
  const publishingExecutions = dashboardExecutions.filter((execution) => String(execution.executionType ?? "").includes("gmp_publishing"));
  const contentStatus = {
    state: drafts.length > 0 ? "active" : "ready",
    summary: `${eligibilityReports.filter((report) => report?.eligible).length} eligible page(s), ${drafts.length} draft(s), ${contentExecutions.length} content execution(s).`,
    pagesEligibleForGeneration: eligibilityReports.filter((report) => report?.eligible).length,
    pagesBlockedFromGeneration: eligibilityReports.filter((report) => report && !report.eligible).length,
    draftsGenerating: drafts.filter((draft) => draft.generationStatus === "GENERATING").length,
    draftsGenerated: drafts.filter((draft) => draft.generationStatus === "GENERATED" || draft.generationStatus === "PARTIALLY_GENERATED").length,
    draftsInReview: drafts.filter((draft) => draft.editorialStatus === "READY_FOR_REVIEW" || draft.editorialStatus === "IN_REVIEW").length,
    draftsWithChangesRequested: drafts.filter((draft) => draft.editorialStatus === "CHANGES_REQUESTED").length,
    approvedDrafts: drafts.filter((draft) => draft.approvalStatus === "APPROVED").length,
    failedGenerationRequests: drafts.filter((draft) => draft.generationStatus === "GENERATION_FAILED").length,
    sectionsGenerated: draftSections.filter((section) => section.generationStatus === "GENERATED").length,
    sectionsFailed: draftSections.filter((section) => section.generationStatus === "GENERATION_FAILED").length,
    sectionsAwaitingReview: draftSections.filter((section) => section.editorialStatus === "READY_FOR_REVIEW" || section.editorialStatus === "IN_REVIEW").length,
    averageEditorialScore: draftValidations.filter(Boolean).length === 0 ? 0 : Math.round(draftValidations.filter(Boolean).reduce((total, validation) => total + (validation?.overallScore ?? 0), 0) / draftValidations.filter(Boolean).length),
    claimValidationFailures: sectionValidations.filter((validation) => (validation?.claimClassifications ?? []).some((entry) => entry.classification === "UNSUPPORTED_CLAIM" || entry.classification === "RESTRICTED_CLAIM" || entry.classification === "PROHIBITED_CLAIM")).length,
    restrictionViolations: sectionValidations.filter((validation) => (validation?.blockingIssues ?? []).some((issue) => String(issue).startsWith("restricted_messaging:"))).length,
    recentGenerationExecutions: contentExecutions.slice(0, 5).map((execution) => ({ executionId: execution.executionId, status: execution.status, createdAt: execution.timing.createdAt })),
  };

  const publishingGovernance = {
    packagesDraft: pagePackages.filter((entry) => entry.packageStatus === "DRAFT" || entry.packageStatus === "BUILDING" || entry.packageStatus === "BUILT").length,
    packagesAwaitingValidation: pagePackages.filter((entry) => entry.packageStatus === "VALIDATION_FAILED" || entry.packageStatus === "READY_FOR_REVIEW").length,
    packagesAwaitingApproval: pagePackages.filter((entry) => entry.packageStatus === "IN_REVIEW").length,
    packagesApproved: pagePackages.filter((entry) => entry.packageStatus === "APPROVED").length,
    releasesScheduled: projectReleases.filter((entry) => entry.releaseStatus === "SCHEDULED").length,
    releasesRunning: projectReleases.filter((entry) => entry.releaseStatus === "RUNNING").length,
    releasesFailed: projectReleases.filter((entry) => entry.releaseStatus === "FAILED").length,
    pagesPublished: pagePublications.filter((entry) => entry.publishedStatus === "published" || entry.publishedStatus === "updated" || entry.publishedStatus === "scheduled").length,
    pagesAwaitingVerification: pagePublications.filter((entry) => entry.verificationStatus === "PENDING").length,
    verificationMismatches: pagePublications.filter((entry) => entry.verificationStatus === "MISMATCH").length,
    remoteDriftDetected: pagePublications.filter((entry) => entry.verificationStatus === "MISMATCH" || entry.verificationStatus === "FAILED").length,
    destinationFailures: projectDestinations.filter((entry) => entry.connectionStatus !== "HEALTHY").length,
    recentPublications: pagePublications.slice(0, 5).map((entry) => ({ publicationRecordId: entry.publicationRecordId, externalUrl: entry.externalUrl, publishedStatus: entry.publishedStatus, createdAt: entry.createdAt })),
    recentRollbacks: projectReleases.filter((entry) => entry.releaseType === "ROLLBACK").slice(0, 5).map((entry) => ({ releaseId: entry.releaseId, status: entry.releaseStatus, createdAt: entry.createdAt })),
    recentPublishingExecutions: publishingExecutions.slice(0, 5).map((execution) => ({ executionId: execution.executionId, status: execution.status, createdAt: execution.timing.createdAt })),
  };

  return json({
    project,
    brandProfile,
    sites,
    publishingConnections: flattenedConnections,
    environmentConfigs: envConfigs,
    runtimeHealth: operations.health,
    workerHealth: operations.workers,
    queueStatus: operations.queue,
    recentActivity: operations.notifications.slice(0, 10),
    executionSummary,
    recentExecutions: dashboardExecutions.slice(0, 10),
    publishingStatus: {
      connected: flattenedConnections.filter((connection) => connection.connectionStatus === "HEALTHY").length,
      degraded: flattenedConnections.filter((connection) => connection.connectionStatus === "DEGRADED").length,
      offline: flattenedConnections.filter((connection) => connection.connectionStatus === "OFFLINE").length,
    },
    knowledgeReadiness: {
      workspaceStatus: knowledgeWorkspace?.lifecycleState ?? "DRAFT",
      completenessScore: latestCompleteness?.overallScore ?? knowledgeWorkspace?.completenessScore ?? 0,
      approvedRecordCount: knowledgeRecords.filter((record) => record.reviewState === "APPROVED").length,
      draftRecordCount: knowledgeRecords.filter((record) => record.reviewState === "DRAFT").length,
      conflictCount: knowledgeConflicts.length,
      recordsRequiringReview: knowledgeReviewQueue.length,
      sourceCount: knowledgeSources.length,
      lastApprovedVersion: knowledgeWorkspace?.workspaceVersion ?? 0,
      futureBusinessGenomeConnectionStatus: project.businessGenomeReference ? "linked" : "pending",
    },
    contentStatus,
    publishingGovernance,
    seoStatus: {
      state: "placeholder",
      summary: "SEO health metrics will be connected in a future GMP milestone.",
    },
    pageArchitecture: pageMetrics,
    pageHealth: pageHealthReport,
  });
}
