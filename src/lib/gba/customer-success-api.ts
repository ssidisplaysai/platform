import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createCustomerSuccessRuntimeService } from "./customer-success-runtime";
import { createInMemoryCustomerSuccessRepository, createPrismaCustomerSuccessRepository, type CustomerSuccessRepository } from "./customer-success-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.customer_success";

type CustomerSuccessAction =
  | "gba:customer_success:view_dashboard"
  | "gba:customer_success:view_customer_health"
  | "gba:customer_success:view_onboarding"
  | "gba:customer_success:view_success_plans"
  | "gba:customer_success:view_renewals"
  | "gba:customer_success:view_satisfaction"
  | "gba:customer_success:view_kpis"
  | "gba:customer_success:view_recommendations"
  | "gba:customer_success:review_recommendations"
  | "gba:customer_success:view_executive_reports"
  | "gba:customer_success:view_timeline"
  | "gba:customer_success:view_health";

export type GbaCustomerSuccessApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: CustomerSuccessRepository;
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

function runtimeFromDeps(input?: GbaCustomerSuccessApiDependencies) {
  const repository = input?.repository ?? createPrismaCustomerSuccessRepository();
  return createCustomerSuccessRuntimeService(repository);
}

async function authorize(input: { request: Request; actionId: CustomerSuccessAction; route: string; dependencies?: GbaCustomerSuccessApiDependencies }): Promise<Authorized> {
  const sessionLoader = input.dependencies?.sessionLoader ?? getGlwSession;
  const url = new URL(input.request.url);
  const workspaceId = workspaceFromUrl(url);
  const organizationId = organizationFromUrl(url);

  const session = await sessionLoader();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) };

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: { workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });

  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) };

  return { actorId: subject.actorId, workspaceId, organizationId };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

export async function handleCustomerSuccessDashboard(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_dashboard", route: "/api/gba/customer-success/dashboard", dependencies });
  if ("error" in access) return access.error;
  return json({ dashboard: await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessCustomerHealth(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_customer_health", route: "/api/gba/customer-success/customer-health", dependencies });
  if ("error" in access) return access.error;
  return json({ customerHealth: await runtimeFromDeps(dependencies).listCustomerHealth(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessOnboarding(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_onboarding", route: "/api/gba/customer-success/onboarding", dependencies });
  if ("error" in access) return access.error;
  return json({ onboarding: await runtimeFromDeps(dependencies).listOnboarding(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessSuccessPlans(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_success_plans", route: "/api/gba/customer-success/success-plans", dependencies });
  if ("error" in access) return access.error;
  return json({ successPlans: await runtimeFromDeps(dependencies).listSuccessPlans(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessRenewals(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_renewals", route: "/api/gba/customer-success/renewals", dependencies });
  if ("error" in access) return access.error;
  return json({ renewals: await runtimeFromDeps(dependencies).listRenewals(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessSatisfaction(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_satisfaction", route: "/api/gba/customer-success/satisfaction", dependencies });
  if ("error" in access) return access.error;
  return json({ satisfaction: await runtimeFromDeps(dependencies).listSatisfaction(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessKpis(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_kpis", route: "/api/gba/customer-success/kpis", dependencies });
  if ("error" in access) return access.error;
  return json({ kpis: await runtimeFromDeps(dependencies).listKpis(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessRecommendations(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_recommendations", route: "/api/gba/customer-success/recommendations", dependencies });
  if ("error" in access) return access.error;
  return json({ recommendations: await runtimeFromDeps(dependencies).listRecommendations(access.workspaceId, access.organizationId) });
}

export async function handleReviewCustomerSuccessRecommendation(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:review_recommendations", route: "/api/gba/customer-success/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await parseBody(request);
  if (!body || typeof body.customerSuccessRecommendationId !== "string" || typeof body.decision !== "string") {
    return json({ error: "customerSuccessRecommendationId and decision are required." }, 400);
  }
  if (!["REVIEWED", "APPROVED", "REJECTED", "DISMISSED"].includes(body.decision)) {
    return json({ error: "decision must be REVIEWED|APPROVED|REJECTED|DISMISSED." }, 400);
  }

  return json({
    review: await runtimeFromDeps(dependencies).reviewRecommendation({
      workspaceId: access.workspaceId,
      organizationId: access.organizationId,
      actorId: access.actorId,
      customerSuccessRecommendationId: body.customerSuccessRecommendationId,
      decision: body.decision as "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED",
      notes: typeof body.notes === "string" ? body.notes : undefined,
    }),
  }, 201);
}

export async function handleCustomerSuccessExecutiveReports(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_executive_reports", route: "/api/gba/customer-success/executive-reports", dependencies });
  if ("error" in access) return access.error;
  return json({ reports: await runtimeFromDeps(dependencies).listExecutiveReports(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessTimeline(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_timeline", route: "/api/gba/customer-success/timeline", dependencies });
  if ("error" in access) return access.error;
  return json({ timeline: await runtimeFromDeps(dependencies).listTimeline(access.workspaceId, access.organizationId) });
}

export async function handleCustomerSuccessHealth(request: Request, dependencies?: GbaCustomerSuccessApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:customer_success:view_health", route: "/api/gba/customer-success/health", dependencies });
  if ("error" in access) return access.error;
  return json({ health: await runtimeFromDeps(dependencies).listHealth(access.workspaceId, access.organizationId) });
}

export function createInMemoryCustomerSuccessApiDependencies(): GbaCustomerSuccessApiDependencies {
  return {
    repository: createInMemoryCustomerSuccessRepository(),
    sessionLoader: getGlwSession,
  };
}
