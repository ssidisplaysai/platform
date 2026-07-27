import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import type { GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import type { GmpRecommendationRepository } from "./recommendation-repository";
import { createPrismaGmpRecommendationRepository } from "./recommendation-repository";
import type { GmpRecommendationServices } from "./recommendation-services";
import { createGmpRecommendationServices } from "./recommendation-services";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.analytics";

type RecommendationAction =
  | "gmp:recommendations:view"
  | "gmp:recommendations:review"
  | "gmp:recommendations:dismiss"
  | "gmp:recommendations:replay"
  | "gmp:recommendations:view_attribution"
  | "gmp:recommendations:view_rule_catalog"
  | "gmp:recommendations:view_decision_support";

export type GmpRecommendationApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  recommendationRepository?: GmpRecommendationRepository;
  recommendationServices?: GmpRecommendationServices;
};

function deps(input?: GmpRecommendationApiDependencies): Required<GmpRecommendationApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const recommendationRepository = input?.recommendationRepository ?? createPrismaGmpRecommendationRepository();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    recommendationRepository,
    recommendationServices: input?.recommendationServices ?? createGmpRecommendationServices({ projectRepository, recommendationRepository }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

type AuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: {
  actionId: RecommendationAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpRecommendationApiDependencies;
}): Promise<AuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) };

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

  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) };
  return { subject };
}

async function ensureProjectInWorkspace(projectId: string, workspaceId: string, dependencies?: GmpRecommendationApiDependencies) {
  const project = await deps(dependencies).projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) return null;
  return project;
}

export async function handleListRecommendations(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:recommendations:view", workspaceId, route: "/api/gmp/recommendations", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const recommendations = await deps(dependencies).recommendationServices.listRecommendations({ projectId, evidenceSnapshotId });
  return json({ recommendations });
}

export async function handleGetRecommendation(request: Request, recommendationId: string, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:recommendations:view", workspaceId, route: "/api/gmp/recommendations/[id]", dependencies });
  if ("error" in access) return access.error;

  const detail = await deps(dependencies).recommendationServices.getRecommendationDetail(recommendationId);
  if (!detail) return json({ error: "Recommendation not found." }, 404);

  const project = await ensureProjectInWorkspace(detail.recommendation.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Recommendation not found." }, 404);

  return json(detail);
}

export async function handleListRecommendationCatalog(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:recommendations:view_rule_catalog", workspaceId, route: "/api/gmp/recommendations/catalog", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const catalog = await deps(dependencies).recommendationServices.listRuleCatalog(projectId);
  return json({ catalog });
}

export async function handleRecommendationHealth(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:recommendations:view_decision_support", workspaceId, route: "/api/gmp/recommendations/health", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const health = await deps(dependencies).recommendationServices.getRecommendationHealth({ projectId, evidenceSnapshotId });
  return json({ health });
}

export async function handleReplayRecommendations(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:recommendations:replay", workspaceId, route: "/api/gmp/recommendations/replay", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string" || typeof body.evidenceSnapshotId !== "string") {
    return json({ error: "projectId and evidenceSnapshotId are required." }, 400);
  }

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const replay = await deps(dependencies).recommendationServices.replayRecommendations({
    workspaceId,
    projectId: body.projectId,
    actorId: access.subject.actorId,
    evidenceSnapshotId: body.evidenceSnapshotId,
    ruleCatalogVersion: typeof body.ruleCatalogVersion === "string" ? body.ruleCatalogVersion : "gmp-recommendation-rule-catalog/v1",
    attributionVersion: typeof body.attributionVersion === "string" ? body.attributionVersion : "gmp-attribution-engine/v1",
    replayOfRunId: typeof body.replayOfRunId === "string" ? body.replayOfRunId : undefined,
  });

  return json(replay, 201);
}

export async function handleReviewRecommendation(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:recommendations:review", workspaceId, route: "/api/gmp/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string" || typeof body.recommendationId !== "string" || typeof body.state !== "string") {
    return json({ error: "projectId, recommendationId, and state are required." }, 400);
  }

  if (body.state !== "REVIEWED" && body.state !== "ACCEPTED" && body.state !== "REJECTED") {
    return json({ error: "state must be REVIEWED, ACCEPTED, or REJECTED." }, 400);
  }

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const event = await deps(dependencies).recommendationServices.reviewRecommendation({
    workspaceId,
    projectId: body.projectId,
    recommendationId: body.recommendationId,
    actorId: access.subject.actorId,
    state: body.state,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });

  return json({ event }, 201);
}

export async function handleDismissRecommendation(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:recommendations:dismiss", workspaceId, route: "/api/gmp/recommendations/dismiss", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string" || typeof body.recommendationId !== "string") {
    return json({ error: "projectId and recommendationId are required." }, 400);
  }

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const event = await deps(dependencies).recommendationServices.dismissRecommendation({
    workspaceId,
    projectId: body.projectId,
    recommendationId: body.recommendationId,
    actorId: access.subject.actorId,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });

  return json({ event }, 201);
}

export async function handleListAttribution(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:recommendations:view_attribution", workspaceId, route: "/api/gmp/attribution", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const attribution = await deps(dependencies).recommendationServices.listAttribution({ projectId, evidenceSnapshotId });
  return json({ attribution });
}

export async function handleDecisionSupport(request: Request, dependencies?: GmpRecommendationApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:recommendations:view_decision_support", workspaceId, route: "/api/gmp/decision-support", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const summaries = await deps(dependencies).recommendationServices.listDecisionSupport({ projectId, evidenceSnapshotId });
  return json({ summaries });
}
