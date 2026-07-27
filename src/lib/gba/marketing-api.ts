import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryMarketingRepository, createPrismaMarketingRepository, type MarketingRepository } from "./marketing-repository";
import { createMarketingRuntimeService } from "./marketing-runtime";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.marketing";

type MarketingAction =
  | "gba:marketing:view_dashboard"
  | "gba:marketing:view_campaigns"
  | "gba:marketing:manage_campaigns"
  | "gba:marketing:view_strategy"
  | "gba:marketing:manage_strategy"
  | "gba:marketing:view_seo"
  | "gba:marketing:view_brand_governance"
  | "gba:marketing:manage_brand_governance"
  | "gba:marketing:view_analytics"
  | "gba:marketing:view_recommendations"
  | "gba:marketing:review_recommendations"
  | "gba:marketing:view_health";

export type GbaMarketingApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: MarketingRepository;
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

function projectFromUrl(url: URL): string | undefined {
  return url.searchParams.get("projectId") ?? undefined;
}

function siteFromUrl(url: URL): string | undefined {
  return url.searchParams.get("siteId") ?? undefined;
}

function runtimeFromDeps(input?: GbaMarketingApiDependencies) {
  const repository = input?.repository ?? createPrismaMarketingRepository();
  return createMarketingRuntimeService(repository);
}

async function authorize(input: { request: Request; actionId: MarketingAction; route: string; dependencies?: GbaMarketingApiDependencies }): Promise<Authorized> {
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

function toPlanInput(body: Record<string, unknown>, workspaceId: string, organizationId: string, actorId: string) {
  return {
    workspaceId,
    organizationId,
    projectId: String(body.projectId ?? ""),
    siteId: typeof body.siteId === "string" ? body.siteId : undefined,
    actorId,
    campaignName: String(body.campaignName ?? ""),
    objective: String(body.objective ?? ""),
    channelFocus: Array.isArray(body.channelFocus) ? body.channelFocus.map((entry) => String(entry)) : [],
    targetAudience: String(body.targetAudience ?? ""),
    budgetCents: typeof body.budgetCents === "number" ? body.budgetCents : 0,
    expectedImpressions: typeof body.expectedImpressions === "number" ? body.expectedImpressions : 0,
    expectedConversions: typeof body.expectedConversions === "number" ? body.expectedConversions : 0,
  };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

export async function handleMarketingDashboard(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_dashboard", route: "/api/gba/marketing/dashboard", dependencies });
  if ("error" in access) return access.error;
  const url = new URL(request.url);
  const dashboard = await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId, projectFromUrl(url), siteFromUrl(url));
  return json({ dashboard });
}

export async function handleMarketingCampaigns(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_campaigns", route: "/api/gba/marketing/campaigns", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ campaigns: await runtimeFromDeps(dependencies).listCampaignPlans(projectId) });
}

export async function handleCreateMarketingCampaignPlan(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:manage_campaigns", route: "/api/gba/marketing/campaigns", dependencies });
  if ("error" in access) return access.error;
  const body = await parseBody(request);
  if (!body || typeof body.projectId !== "string" || typeof body.campaignName !== "string" || typeof body.objective !== "string" || typeof body.targetAudience !== "string") {
    return json({ error: "projectId, campaignName, objective, and targetAudience are required." }, 400);
  }
  const campaign = await runtimeFromDeps(dependencies).createCampaignPlan(toPlanInput(body, access.workspaceId, access.organizationId, access.actorId));
  return json({ campaign }, 201);
}

export async function handleMarketingStrategy(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_strategy", route: "/api/gba/marketing/strategy", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ strategy: await runtimeFromDeps(dependencies).listContentStrategies(projectId) });
}

export async function handleMarketingSeo(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_seo", route: "/api/gba/marketing/seo", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ seo: await runtimeFromDeps(dependencies).listSeoIntelligence(projectId) });
}

export async function handleMarketingBrandGovernance(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_brand_governance", route: "/api/gba/marketing/brand-governance", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ brandGovernance: await runtimeFromDeps(dependencies).listBrandGovernanceReviews(projectId) });
}

export async function handleMarketingAnalytics(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_analytics", route: "/api/gba/marketing/analytics", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ analytics: await runtimeFromDeps(dependencies).listAnalyticsSnapshots(projectId) });
}

export async function handleMarketingRecommendations(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_recommendations", route: "/api/gba/marketing/recommendations", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ recommendations: await runtimeFromDeps(dependencies).listRecommendations(projectId) });
}

export async function handleReviewMarketingRecommendation(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:review_recommendations", route: "/api/gba/marketing/recommendations/review", dependencies });
  if ("error" in access) return access.error;
  const body = await parseBody(request);
  if (!body || typeof body.projectId !== "string" || typeof body.marketingRecommendationId !== "string" || typeof body.decision !== "string") {
    return json({ error: "projectId, marketingRecommendationId, and decision are required." }, 400);
  }
  if (!["REVIEWED", "APPROVED", "REJECTED", "DISMISSED"].includes(body.decision)) {
    return json({ error: "decision must be REVIEWED, APPROVED, REJECTED, or DISMISSED." }, 400);
  }
  const review = await runtimeFromDeps(dependencies).reviewRecommendation({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    projectId: body.projectId,
    recommendationId: body.marketingRecommendationId,
    actorId: access.actorId,
    decision: body.decision as "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED",
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });
  return json({ review }, 201);
}

export async function handleMarketingTimeline(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_dashboard", route: "/api/gba/marketing/timeline", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ timeline: await runtimeFromDeps(dependencies).listTimeline(projectId) });
}

export async function handleMarketingExecutiveReports(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_dashboard", route: "/api/gba/marketing/executive-reports", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ executiveReports: await runtimeFromDeps(dependencies).listExecutiveReports(projectId) });
}

export async function handleMarketingHealth(request: Request, dependencies?: GbaMarketingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:marketing:view_health", route: "/api/gba/marketing/health", dependencies });
  if ("error" in access) return access.error;
  const projectId = projectFromUrl(new URL(request.url));
  if (!projectId) return json({ error: "projectId is required." }, 400);
  return json({ health: await runtimeFromDeps(dependencies).listHealth(projectId) });
}

export function createInMemoryMarketingApiDependencies(): GbaMarketingApiDependencies {
  return { repository: createInMemoryMarketingRepository(), sessionLoader: getGlwSession };
}
