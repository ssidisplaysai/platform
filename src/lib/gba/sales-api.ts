import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemorySalesRepository, createPrismaSalesRepository, type SalesRepository } from "./sales-repository";
import { createSalesRuntimeService } from "./sales-runtime";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.sales";

type SalesAction =
  | "gba:sales:view_dashboard"
  | "gba:sales:view_pipeline"
  | "gba:sales:manage_pipeline"
  | "gba:sales:view_forecasting"
  | "gba:sales:view_accounts"
  | "gba:sales:view_recommendations"
  | "gba:sales:review_recommendations"
  | "gba:sales:view_health";

export type GbaSalesApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: SalesRepository;
};

type Authorized =
  | { error: NextResponse }
  | { actorId: string; workspaceId: string; organizationId: string };

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function organizationFromUrl(url: URL): string {
  return url.searchParams.get("organizationId") ?? DEFAULT_ORGANIZATION_ID;
}

function runtimeFromDeps(input?: GbaSalesApiDependencies) {
  const repository = input?.repository ?? createPrismaSalesRepository();
  return createSalesRuntimeService(repository);
}

async function authorize(input: {
  request: Request;
  actionId: SalesAction;
  route: string;
  dependencies?: GbaSalesApiDependencies;
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
    resource: { workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) };
  }

  return { actorId: subject.actorId, workspaceId, organizationId };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

export async function handleSalesDashboard(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_dashboard", route: "/api/gba/sales/dashboard", dependencies });
  if ("error" in access) return access.error;
  const dashboard = await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId);
  return json({ dashboard });
}

export async function handleSalesPipeline(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_pipeline", route: "/api/gba/sales/pipeline", dependencies });
  if ("error" in access) return access.error;
  const pipeline = await runtimeFromDeps(dependencies).listPipeline(access.workspaceId, access.organizationId);
  return json({ pipeline });
}

export async function handleCreateSalesPipelineRecord(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:manage_pipeline", route: "/api/gba/sales/pipeline", dependencies });
  if ("error" in access) return access.error;

  const body = await parseBody(request);
  if (!body || typeof body.accountId !== "string" || typeof body.accountName !== "string" || typeof body.opportunityReference !== "string") {
    return json({ error: "accountId, accountName, and opportunityReference are required." }, 400);
  }

  if (typeof body.amountCents !== "number" || typeof body.probabilityPercent !== "number" || typeof body.expectedCloseAt !== "string") {
    return json({ error: "amountCents, probabilityPercent, and expectedCloseAt are required." }, 400);
  }

  const stage = typeof body.stage === "string" ? body.stage : "PROSPECT";
  if (!["PROSPECT", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "COMMITTED"].includes(stage)) {
    return json({ error: "stage must be PROSPECT|QUALIFIED|PROPOSAL|NEGOTIATION|COMMITTED." }, 400);
  }

  const created = await runtimeFromDeps(dependencies).createPipelineRecord({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    accountId: body.accountId,
    accountName: body.accountName,
    opportunityReference: body.opportunityReference,
    stage: stage as "PROSPECT" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "COMMITTED",
    amountCents: body.amountCents,
    probabilityPercent: body.probabilityPercent,
    expectedCloseAt: body.expectedCloseAt,
  });

  return json({ pipelineRecord: created }, 201);
}

export async function handleSalesForecasting(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_forecasting", route: "/api/gba/sales/forecasting", dependencies });
  if ("error" in access) return access.error;
  const forecasting = await runtimeFromDeps(dependencies).listForecasts(access.workspaceId, access.organizationId);
  return json({ forecasting });
}

export async function handleSalesAccounts(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_accounts", route: "/api/gba/sales/accounts", dependencies });
  if ("error" in access) return access.error;
  const accounts = await runtimeFromDeps(dependencies).listAccounts(access.workspaceId, access.organizationId);
  return json({ accounts });
}

export async function handleSalesRecommendations(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_recommendations", route: "/api/gba/sales/recommendations", dependencies });
  if ("error" in access) return access.error;
  const recommendations = await runtimeFromDeps(dependencies).listRecommendations(access.workspaceId, access.organizationId);
  return json({ recommendations });
}

export async function handleReviewSalesRecommendation(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:review_recommendations", route: "/api/gba/sales/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await parseBody(request);
  if (!body || typeof body.salesRecommendationId !== "string" || typeof body.decision !== "string") {
    return json({ error: "salesRecommendationId and decision are required." }, 400);
  }

  if (!["REVIEWED", "APPROVED", "REJECTED", "DISMISSED"].includes(body.decision)) {
    return json({ error: "decision must be REVIEWED|APPROVED|REJECTED|DISMISSED." }, 400);
  }

  const review = await runtimeFromDeps(dependencies).reviewRecommendation({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    salesRecommendationId: body.salesRecommendationId,
    decision: body.decision as "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED",
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return json({ review }, 201);
}

export async function handleSalesTimeline(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_dashboard", route: "/api/gba/sales/timeline", dependencies });
  if ("error" in access) return access.error;
  const timeline = await runtimeFromDeps(dependencies).listTimeline(access.workspaceId, access.organizationId);
  return json({ timeline });
}

export async function handleSalesHealth(request: Request, dependencies?: GbaSalesApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:sales:view_health", route: "/api/gba/sales/health", dependencies });
  if ("error" in access) return access.error;
  const health = await runtimeFromDeps(dependencies).listHealth(access.workspaceId, access.organizationId);
  return json({ health });
}

export function createInMemorySalesApiDependencies(): GbaSalesApiDependencies {
  return {
    repository: createInMemorySalesRepository(),
    sessionLoader: getGlwSession,
  };
}
