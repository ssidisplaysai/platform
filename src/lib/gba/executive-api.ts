import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createExecutiveRuntimeService } from "./executive-runtime";
import { createInMemoryExecutiveRepository, createPrismaExecutiveRepository, type ExecutiveRepository } from "./executive-repository";
import type { ExecutiveDelegation } from "./executive-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.executive";

const EXECUTIVE_TARGET_AGENTS: ExecutiveDelegation["targetAgent"][] = [
  "MARKETING_AGENT",
  "SALES_AGENT",
  "FINANCE_AGENT",
  "MANUFACTURING_AGENT",
  "OPERATIONS_AGENT",
  "CUSTOMER_SUCCESS_AGENT",
  "ENGINEERING_AGENT",
  "HR_AGENT",
];

type ExecutiveAction =
  | "gba:executive:view_dashboard"
  | "gba:executive:view_briefings"
  | "gba:executive:generate_briefings"
  | "gba:executive:view_kpis"
  | "gba:executive:manage_kpis"
  | "gba:executive:view_goals"
  | "gba:executive:manage_goals"
  | "gba:executive:view_recommendations"
  | "gba:executive:review_recommendations"
  | "gba:executive:delegate_work"
  | "gba:executive:view_risks"
  | "gba:executive:manage_risks"
  | "gba:executive:view_opportunities"
  | "gba:executive:view_health";

export type GbaExecutiveApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: ExecutiveRepository;
};

type Authorized =
  | { error: NextResponse }
  | { actorId: string; role: string; workspaceId: string; organizationId: string; permissions: string[] };

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function organizationFromUrl(url: URL): string {
  return url.searchParams.get("organizationId") ?? DEFAULT_ORGANIZATION_ID;
}

function runtimeFromDeps(input?: GbaExecutiveApiDependencies) {
  const repository = input?.repository ?? createPrismaExecutiveRepository();
  return createExecutiveRuntimeService(repository);
}

async function authorize(input: {
  request: Request;
  actionId: ExecutiveAction;
  route: string;
  dependencies?: GbaExecutiveApiDependencies;
}): Promise<Authorized> {
  const sessionLoader = input.dependencies?.sessionLoader ?? getGlwSession;

  const url = new URL(input.request.url);
  const workspaceId = workspaceFromUrl(url);
  const organizationId = organizationFromUrl(url);

  const session = await sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId,
      moduleId: DEFAULT_MODULE_ID,
      route: input.route,
    },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) };
  }

  return {
    actorId: subject.actorId,
    role: subject.role,
    workspaceId,
    organizationId,
    permissions: subject.permissions,
  };
}

export async function handleExecutiveDashboard(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_dashboard", route: "/api/gba/executive/dashboard", dependencies });
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const dashboard = await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId, {
    company: url.searchParams.get("company") ?? undefined,
    division: url.searchParams.get("division") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    geography: url.searchParams.get("geography") ?? undefined,
  });

  return json({ dashboard });
}

export async function handleExecutiveBriefings(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_briefings", route: "/api/gba/executive/briefings", dependencies });
  if ("error" in access) return access.error;

  const briefings = await runtimeFromDeps(dependencies).listBriefings(access.workspaceId);
  return json({ briefings });
}

export async function handleGenerateExecutiveBriefing(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:generate_briefings", route: "/api/gba/executive/briefings/generate", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const briefing = await runtimeFromDeps(dependencies).generateBriefing({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    period: typeof body?.period === "string" ? body.period : undefined,
  });

  return json({ briefing }, 201);
}

export async function handleExecutiveGoals(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_goals", route: "/api/gba/executive/goals", dependencies });
  if ("error" in access) return access.error;

  const goals = await runtimeFromDeps(dependencies).listGoals(access.workspaceId);
  return json({ goals });
}

export async function handleExecutiveKpis(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_kpis", route: "/api/gba/executive/kpis", dependencies });
  if ("error" in access) return access.error;

  const kpis = await runtimeFromDeps(dependencies).listKpis(access.workspaceId);
  return json({ kpis });
}

export async function handleExecutiveRecommendations(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_recommendations", route: "/api/gba/executive/recommendations", dependencies });
  if ("error" in access) return access.error;

  const runtime = runtimeFromDeps(dependencies);
  const recommendations = await runtime.listRecommendations(access.workspaceId);
  return json({ recommendations });
}

export async function handleReviewExecutiveRecommendation(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:review_recommendations", route: "/api/gba/executive/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.recommendationId !== "string" || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) {
    return json({ error: "recommendationId and decision(APPROVED|REJECTED) are required." }, 400);
  }

  const review = await runtimeFromDeps(dependencies).reviewRecommendation({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    recommendationId: body.recommendationId,
    decision: body.decision,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return json({ review }, 201);
}

export async function handleExecutiveRisks(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_risks", route: "/api/gba/executive/risks", dependencies });
  if ("error" in access) return access.error;

  const risks = await runtimeFromDeps(dependencies).listRisks(access.workspaceId);
  return json({ risks });
}

export async function handleExecutiveOpportunities(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_opportunities", route: "/api/gba/executive/opportunities", dependencies });
  if ("error" in access) return access.error;

  const opportunities = await runtimeFromDeps(dependencies).listOpportunities(access.workspaceId);
  return json({ opportunities });
}

export async function handleExecutiveDelegate(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:delegate_work", route: "/api/gba/executive/delegate", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.targetAgent !== "string" || typeof body.objective !== "string") {
    return json({ error: "targetAgent and objective are required." }, 400);
  }

  if (!EXECUTIVE_TARGET_AGENTS.includes(body.targetAgent as ExecutiveDelegation["targetAgent"])) {
    return json({ error: "targetAgent is invalid." }, 400);
  }

  const delegation = await runtimeFromDeps(dependencies).delegateWork({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    targetAgent: body.targetAgent as ExecutiveDelegation["targetAgent"],
    objective: body.objective,
  });

  return json({ delegation }, 201);
}

export async function handleExecutiveHealth(request: Request, dependencies?: GbaExecutiveApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:executive:view_health", route: "/api/gba/executive/health", dependencies });
  if ("error" in access) return access.error;

  const health = await runtimeFromDeps(dependencies).listHealth(access.workspaceId);
  return json({ health });
}

export function createInMemoryExecutiveApiDependencies(): GbaExecutiveApiDependencies {
  return {
    repository: createInMemoryExecutiveRepository(),
  };
}
