import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import type { GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import type { GmpEvidenceRepository } from "./evidence-repository";
import { createPrismaGmpEvidenceRepository } from "./evidence-repository";
import type { GmpEvidenceServices } from "./evidence-services";
import { createGmpEvidenceServices } from "./evidence-services";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.analytics";

type EvidenceAction =
  | "gmp:evidence:view"
  | "gmp:evidence:view_snapshots"
  | "gmp:evidence:view_compiler_runs"
  | "gmp:evidence:run_compiler"
  | "gmp:evidence:replay_compilation"
  | "gmp:evidence:view_metric_catalog";

export type GmpEvidenceApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  evidenceRepository?: GmpEvidenceRepository;
  evidenceServices?: GmpEvidenceServices;
};

function deps(input?: GmpEvidenceApiDependencies): Required<GmpEvidenceApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const evidenceRepository = input?.evidenceRepository ?? createPrismaGmpEvidenceRepository();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    evidenceRepository,
    evidenceServices: input?.evidenceServices ?? createGmpEvidenceServices({ projectRepository, evidenceRepository }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

type EvidenceAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: {
  actionId: EvidenceAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpEvidenceApiDependencies;
}): Promise<EvidenceAuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) };
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
    return { error: json({ error: decision.reason }, 403) };
  }

  return { subject };
}

async function ensureProjectInWorkspace(projectId: string, workspaceId: string, dependencies?: GmpEvidenceApiDependencies) {
  const project = await deps(dependencies).projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }
  return project;
}

export async function handleListEvidenceSnapshots(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:evidence:view_snapshots", workspaceId, route: "/api/gmp/evidence/snapshots", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const snapshots = await deps(dependencies).evidenceServices.listSnapshots(projectId);
  return json({ snapshots });
}

export async function handleGetEvidenceSnapshot(request: Request, evidenceSnapshotId: string, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:evidence:view_snapshots", workspaceId, route: "/api/gmp/evidence/snapshots/[id]", dependencies });
  if ("error" in access) return access.error;

  const detail = await deps(dependencies).evidenceServices.getSnapshotDetail(evidenceSnapshotId);
  if (!detail) return json({ error: "Evidence snapshot not found." }, 404);

  const project = await ensureProjectInWorkspace(detail.snapshot.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Evidence snapshot not found." }, 404);

  return json(detail);
}

export async function handleListEvidenceMetrics(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:evidence:view", workspaceId, route: "/api/gmp/evidence/metrics", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const metrics = await deps(dependencies).evidenceServices.listMetrics({ projectId, evidenceSnapshotId });
  return json({ metrics });
}

export async function handleListEvidencePublications(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:evidence:view", workspaceId, route: "/api/gmp/evidence/publications", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const evidenceSnapshotId = url.searchParams.get("snapshotId") ?? undefined;
  const publications = await deps(dependencies).evidenceServices.listPublications({ projectId, evidenceSnapshotId });
  return json({ publications });
}

export async function handleRecompileEvidence(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.projectId !== "string") {
    return json({ error: "projectId is required." }, 400);
  }

  const replayRequested = typeof body.replayOfRunId === "string" && body.replayOfRunId.trim().length > 0;
  const actionId: EvidenceAction = replayRequested ? "gmp:evidence:replay_compilation" : "gmp:evidence:run_compiler";
  const access = await authorize({ actionId, workspaceId, route: "/api/gmp/evidence/recompile", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProjectInWorkspace(body.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const cadence = typeof body.cadence === "string" ? body.cadence.toUpperCase() : undefined;
  const result = await deps(dependencies).evidenceServices.recompileEvidence({
    workspaceId,
    projectId: body.projectId,
    actorId: access.subject.actorId,
    siteId: typeof body.siteId === "string" ? body.siteId : undefined,
    periodStart: typeof body.periodStart === "string" ? body.periodStart : undefined,
    periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : undefined,
    cadence: cadence === "DAILY" || cadence === "WEEKLY" || cadence === "MONTHLY" ? cadence : undefined,
    replayOfRunId: replayRequested ? String(body.replayOfRunId) : undefined,
  });

  return json(result, 201);
}

export async function handleListEvidenceCompilerRuns(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:evidence:view_compiler_runs", workspaceId, route: "/api/gmp/evidence/runs", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const runs = await deps(dependencies).evidenceServices.listCompilerRuns(projectId);
  return json({ runs });
}

export async function handleListEvidenceMetricCatalog(request: Request, dependencies?: GmpEvidenceApiDependencies): Promise<NextResponse> {
  const url = new URL(request.url);
  const workspaceId = workspaceFromUrl(url);
  const access = await authorize({ actionId: "gmp:evidence:view_metric_catalog", workspaceId, route: "/api/gmp/evidence/catalog", dependencies });
  if ("error" in access) return access.error;

  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId is required." }, 400);

  const project = await ensureProjectInWorkspace(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const metricCatalog = await deps(dependencies).evidenceServices.listMetricCatalog(projectId);
  return json({ metricCatalog });
}
