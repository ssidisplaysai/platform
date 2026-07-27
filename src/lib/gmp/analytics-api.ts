import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import type { GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import type { GmpAnalyticsRepository } from "./analytics-repository";
import { createPrismaGmpAnalyticsRepository } from "./analytics-repository";
import type { GmpAnalyticsServices } from "./analytics-services";
import { createGmpAnalyticsServices } from "./analytics-services";
import { gmpAnalyticsCollectionModes, type GmpAnalyticsCollectionMode } from "./analytics-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.analytics";

type AnalyticsAction =
  | "gmp:analytics:view"
  | "gmp:analytics:manage_sources"
  | "gmp:analytics:run_collection"
  | "gmp:analytics:validate_source"
  | "gmp:analytics:view_capabilities"
  | "gmp:analytics:view_health"
  | "gmp:analytics:view_collections"
  | "gmp:analytics:view_collection_detail"
  | "gmp:analytics:retry_collection"
  | "gmp:analytics:view_collection_timeline"
  | "gmp:analytics:view_snapshots"
  | "gmp:analytics:view_configuration"
  | "gmp:analytics:manage_configuration";

export type GmpAnalyticsApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  analyticsRepository?: GmpAnalyticsRepository;
  analyticsServices?: GmpAnalyticsServices;
};

function deps(input?: GmpAnalyticsApiDependencies): Required<GmpAnalyticsApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const analyticsRepository = input?.analyticsRepository ?? createPrismaGmpAnalyticsRepository();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    analyticsRepository,
    analyticsServices: input?.analyticsServices ?? createGmpAnalyticsServices({ projectRepository, analyticsRepository }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function parseCollectionMode(value: unknown): GmpAnalyticsCollectionMode {
  if (typeof value !== "string") {
    return "MANUAL";
  }

  return (gmpAnalyticsCollectionModes as readonly string[]).includes(value)
    ? value as GmpAnalyticsCollectionMode
    : "MANUAL";
}

type AnalyticsAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: {
  actionId: AnalyticsAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpAnalyticsApiDependencies;
}): Promise<AnalyticsAuthorizeResult> {
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

async function ensureProjectInWorkspace(projectId: string, workspaceId: string, dependencies?: GmpAnalyticsApiDependencies) {
  const project = await deps(dependencies).projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }
  return project;
}

async function ensureSourceInWorkspace(analyticsSourceId: string, workspaceId: string, dependencies?: GmpAnalyticsApiDependencies) {
  const d = deps(dependencies);
  const source = await d.analyticsRepository.getSourceById(analyticsSourceId);
  if (!source) {
    return null;
  }

  const project = await ensureProjectInWorkspace(source.projectId, workspaceId, dependencies);
  return project ? source : null;
}

async function ensureCollectionInWorkspace(analyticsCollectionId: string, workspaceId: string, dependencies?: GmpAnalyticsApiDependencies) {
  const d = deps(dependencies);
  const collection = await d.analyticsRepository.getCollectionById(analyticsCollectionId);
  if (!collection) {
    return null;
  }

  const project = await ensureProjectInWorkspace(collection.projectId, workspaceId, dependencies);
  return project ? collection : null;
}

export async function handleListAnalyticsSources(request: Request, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:analytics:view", workspaceId, route: "/api/gmp/analytics/sources", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return json({ error: "projectId is required." }, 400);
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const d = deps(dependencies);
  const [sources, metricDefinitions, foundationConfig] = await Promise.all([
    d.analyticsServices.listSources(projectId),
    d.analyticsServices.listMetricDefinitions(projectId),
    d.analyticsServices.ensureFoundationConfig(projectId),
  ]);

  return json({ sources, metricDefinitions, foundationConfig });
}

export async function handleCreateAnalyticsSource(request: Request, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:manage_sources", workspaceId, route: "/api/gmp/analytics/sources", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string" || typeof body.sourceType !== "string" || typeof body.sourceName !== "string") {
    return json({ error: "projectId, sourceType, and sourceName are required." }, 400);
  }

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const source = await deps(dependencies).analyticsServices.createSource({
    projectId: body.projectId,
    siteId: typeof body.siteId === "string" ? body.siteId : undefined,
    sourceType: body.sourceType,
    sourceName: body.sourceName,
    providerReference: typeof body.providerReference === "string" ? body.providerReference : undefined,
    credentialsReference: typeof body.credentialsReference === "string" ? body.credentialsReference : undefined,
    configuration: typeof body.configuration === "object" && body.configuration !== null ? body.configuration as Record<string, unknown> : undefined,
    capabilities: typeof body.capabilities === "object" && body.capabilities !== null ? body.capabilities as Record<string, boolean> : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  if (!source) {
    return json({ error: "Unable to create source." }, 409);
  }

  return json({ source }, 201);
}

export async function handleGetAnalyticsSource(request: Request, analyticsSourceId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:view", workspaceId, route: "/api/gmp/analytics/sources/[id]", dependencies });
  if ("error" in access) return access.error;

  const source = await ensureSourceInWorkspace(analyticsSourceId, workspaceId, dependencies);
  if (!source) {
    return json({ error: "Source not found." }, 404);
  }

  const detail = await deps(dependencies).analyticsServices.getSourceDetail(analyticsSourceId);
  if (!detail) {
    return json({ error: "Source not found." }, 404);
  }

  return json(detail);
}

export async function handleValidateAnalyticsSource(request: Request, analyticsSourceId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:validate_source", workspaceId, route: "/api/gmp/analytics/sources/[id]/validate", dependencies });
  if ("error" in access) return access.error;

  const source = await ensureSourceInWorkspace(analyticsSourceId, workspaceId, dependencies);
  if (!source) {
    return json({ error: "Source not found." }, 404);
  }

  const validation = await deps(dependencies).analyticsServices.validateSource(analyticsSourceId);
  if (!validation) {
    return json({ error: "Source not found." }, 404);
  }

  return json(validation);
}

export async function handleGetAnalyticsSourceCapabilities(request: Request, analyticsSourceId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:view_capabilities", workspaceId, route: "/api/gmp/analytics/sources/[id]/capabilities", dependencies });
  if ("error" in access) return access.error;

  const source = await ensureSourceInWorkspace(analyticsSourceId, workspaceId, dependencies);
  if (!source) {
    return json({ error: "Source not found." }, 404);
  }

  const capabilities = await deps(dependencies).analyticsServices.detectSourceCapabilities(analyticsSourceId);
  if (!capabilities) {
    return json({ error: "Source not found." }, 404);
  }

  return json(capabilities);
}

export async function handleGetAnalyticsSourceHealth(request: Request, analyticsSourceId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:view_health", workspaceId, route: "/api/gmp/analytics/sources/[id]/health", dependencies });
  if ("error" in access) return access.error;

  const source = await ensureSourceInWorkspace(analyticsSourceId, workspaceId, dependencies);
  if (!source) {
    return json({ error: "Source not found." }, 404);
  }

  const health = await deps(dependencies).analyticsServices.getSourceHealth(analyticsSourceId);
  if (!health) {
    return json({ error: "Source not found." }, 404);
  }

  return json({ health });
}

export async function handleListAnalyticsCollections(request: Request, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:analytics:view_collections", workspaceId, route: "/api/gmp/analytics/collections", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return json({ error: "projectId is required." }, 400);
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const collections = await deps(dependencies).analyticsServices.listCollections(projectId);
  return json({ collections });
}

export async function handleCreateAnalyticsCollection(request: Request, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:run_collection", workspaceId, route: "/api/gmp/analytics/collections", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string" || typeof body.analyticsSourceId !== "string") {
    return json({ error: "projectId and analyticsSourceId are required." }, 400);
  }

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const source = await ensureSourceInWorkspace(body.analyticsSourceId, workspaceId, dependencies);
  if (!source || source.projectId !== body.projectId) {
    return json({ error: "Source not found." }, 404);
  }

  if (Boolean(body.forcedRecollection)) {
    return json({
      error: "Forced recollection is deferred until dedicated authorization and confirmation controls are certified.",
      code: "FORCED_RECOLLECTION_DEFERRED",
    }, 409);
  }

  const d = deps(dependencies);
  const result = await d.analyticsServices.requestCollection({
    workspaceId,
    projectId: body.projectId,
    siteId: typeof body.siteId === "string" ? body.siteId : source.siteId,
    analyticsSourceId: body.analyticsSourceId,
    actorId: access.subject.actorId,
    collectionMode: parseCollectionMode(body.collectionMode),
    periodStart: typeof body.periodStart === "string" ? body.periodStart : undefined,
    periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : undefined,
    requestedDimensions: Array.isArray(body.requestedDimensions) ? body.requestedDimensions.map(String) : [],
    requestedMetrics: Array.isArray(body.requestedMetrics) ? body.requestedMetrics.map(String) : [],
    idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    forcedRecollection: Boolean(body.forcedRecollection),
    sourceCursor: typeof body.sourceCursor === "object" && body.sourceCursor !== null ? body.sourceCursor as Record<string, unknown> : undefined,
  });

  const snapshotLabel = typeof body.snapshotLabel === "string" ? body.snapshotLabel : `Collection ${result.collection.analyticsCollectionId}`;
  const snapshot = result.collection.collectionStatus === "COMPLETED" || result.collection.collectionStatus === "COMPLETED_WITH_WARNINGS"
    ? await d.analyticsServices.createSnapshotFromCollection({
      projectId: body.projectId,
      analyticsCollectionId: result.collection.analyticsCollectionId,
      snapshotLabel,
      siteId: source.siteId,
    })
    : null;

  return json({ ...result, snapshot }, 201);
}

export async function handleGetAnalyticsCollection(request: Request, analyticsCollectionId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:view_collection_detail", workspaceId, route: "/api/gmp/analytics/collections/[id]", dependencies });
  if ("error" in access) return access.error;

  const collection = await ensureCollectionInWorkspace(analyticsCollectionId, workspaceId, dependencies);
  if (!collection) {
    return json({ error: "Collection not found." }, 404);
  }

  const detail = await deps(dependencies).analyticsServices.getCollectionDetail(analyticsCollectionId);
  if (!detail) {
    return json({ error: "Collection not found." }, 404);
  }

  return json(detail);
}

export async function handleRetryAnalyticsCollection(request: Request, analyticsCollectionId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:retry_collection", workspaceId, route: "/api/gmp/analytics/collections/[id]/retry", dependencies });
  if ("error" in access) return access.error;

  const collection = await ensureCollectionInWorkspace(analyticsCollectionId, workspaceId, dependencies);
  if (!collection) {
    return json({ error: "Collection not found." }, 404);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const retryMode = body && typeof body.mode === "string" ? body.mode : undefined;
  const result = await deps(dependencies).analyticsServices.retryCollection({
    workspaceId,
    collectionId: analyticsCollectionId,
    actorId: access.subject.actorId,
    mode: retryMode === "restart" ? "restart" : "resume",
  });

  if (!result) {
    return json({ error: "Collection cannot be retried." }, 409);
  }

  return json(result, 201);
}

export async function handleGetAnalyticsCollectionTimeline(request: Request, analyticsCollectionId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:analytics:view_collection_timeline", workspaceId, route: "/api/gmp/analytics/collections/[id]/timeline", dependencies });
  if ("error" in access) return access.error;

  const collection = await ensureCollectionInWorkspace(analyticsCollectionId, workspaceId, dependencies);
  if (!collection) {
    return json({ error: "Collection not found." }, 404);
  }

  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
  const afterOccurredAt = url.searchParams.get("afterOccurredAt") ?? undefined;
  const afterEventId = url.searchParams.get("afterEventId") ?? undefined;

  const timeline = await deps(dependencies).analyticsServices.getCollectionTimeline({
    collectionId: analyticsCollectionId,
    limit: Number.isFinite(parsedLimit as number) ? parsedLimit : undefined,
    after: afterOccurredAt && afterEventId
      ? { occurredAt: afterOccurredAt, analyticsCollectionEventId: afterEventId }
      : undefined,
  });

  if (!timeline) {
    return json({ error: "Collection not found." }, 404);
  }

  return json({
    collectionId: analyticsCollectionId,
    contractVersion: timeline.contractVersion,
    events: timeline.events,
    nextCursor: timeline.nextCursor,
  });
}

export async function handleListAnalyticsSnapshots(request: Request, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:analytics:view_snapshots", workspaceId, route: "/api/gmp/analytics/snapshots", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return json({ error: "projectId is required." }, 400);
  }

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Project not found." }, 404);
  }

  const snapshots = await deps(dependencies).analyticsServices.listSnapshots(projectId);
  return json({ snapshots });
}

export async function handleGetAnalyticsSnapshot(request: Request, performanceSnapshotId: string, dependencies?: GmpAnalyticsApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:analytics:view_snapshots", workspaceId, route: "/api/gmp/analytics/snapshots/[id]", dependencies });
  if ("error" in access) return access.error;

  const detail = await deps(dependencies).analyticsServices.getSnapshotDetail(performanceSnapshotId);
  if (!detail) {
    return json({ error: "Snapshot not found." }, 404);
  }

  const project = await ensureProjectInWorkspace(detail.snapshot.projectId, workspaceId, dependencies);
  if (!project) {
    return json({ error: "Snapshot not found." }, 404);
  }

  return json(detail);
}
