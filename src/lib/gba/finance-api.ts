import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryFinanceRepository, createPrismaFinanceRepository, type FinanceRepository } from "./finance-repository";
import { createFinanceRuntimeService } from "./finance-runtime";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.finance";

type FinanceAction =
  | "gba:finance:view_dashboard"
  | "gba:finance:view_general_ledger"
  | "gba:finance:view_accounts_receivable"
  | "gba:finance:view_accounts_payable"
  | "gba:finance:view_budgets"
  | "gba:finance:manage_budgets"
  | "gba:finance:view_profitability"
  | "gba:finance:view_forecasts"
  | "gba:finance:view_kpis"
  | "gba:finance:view_recommendations"
  | "gba:finance:review_recommendations"
  | "gba:finance:view_executive_reports"
  | "gba:finance:view_health";

export type GbaFinanceApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: FinanceRepository;
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

function runtimeFromDeps(input?: GbaFinanceApiDependencies) {
  const repository = input?.repository ?? createPrismaFinanceRepository();
  return createFinanceRuntimeService(repository);
}

async function authorize(input: { request: Request; actionId: FinanceAction; route: string; dependencies?: GbaFinanceApiDependencies }): Promise<Authorized> {
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

export async function handleFinanceDashboard(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_dashboard", route: "/api/gba/finance/dashboard", dependencies });
  if ("error" in access) return access.error;
  return json({ dashboard: await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId) });
}

export async function handleFinanceGeneralLedger(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_general_ledger", route: "/api/gba/finance/general-ledger", dependencies });
  if ("error" in access) return access.error;
  const runtime = runtimeFromDeps(dependencies);
  return json({ ledger: await runtime.listGeneralLedger(access.workspaceId, access.organizationId), chartOfAccounts: await runtime.listChartOfAccounts(access.workspaceId, access.organizationId) });
}

export async function handleFinanceAccountsReceivable(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_accounts_receivable", route: "/api/gba/finance/accounts-receivable", dependencies });
  if ("error" in access) return access.error;
  return json({ receivables: await runtimeFromDeps(dependencies).listAccountsReceivable(access.workspaceId, access.organizationId) });
}

export async function handleFinanceAccountsPayable(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_accounts_payable", route: "/api/gba/finance/accounts-payable", dependencies });
  if ("error" in access) return access.error;
  return json({ payables: await runtimeFromDeps(dependencies).listAccountsPayable(access.workspaceId, access.organizationId) });
}

export async function handleFinanceBudgets(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_budgets", route: "/api/gba/finance/budgets", dependencies });
  if ("error" in access) return access.error;
  return json({ budgets: await runtimeFromDeps(dependencies).listBudgets(access.workspaceId, access.organizationId) });
}

export async function handleFinanceProfitability(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_profitability", route: "/api/gba/finance/profitability", dependencies });
  if ("error" in access) return access.error;
  return json({ profitability: await runtimeFromDeps(dependencies).listProfitability(access.workspaceId, access.organizationId) });
}

export async function handleFinanceForecasts(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_forecasts", route: "/api/gba/finance/forecasts", dependencies });
  if ("error" in access) return access.error;
  return json({ forecasts: await runtimeFromDeps(dependencies).listForecasts(access.workspaceId, access.organizationId) });
}

export async function handleFinanceKpis(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_kpis", route: "/api/gba/finance/kpis", dependencies });
  if ("error" in access) return access.error;
  return json({ kpis: await runtimeFromDeps(dependencies).listKpis(access.workspaceId, access.organizationId) });
}

export async function handleFinanceRecommendations(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_recommendations", route: "/api/gba/finance/recommendations", dependencies });
  if ("error" in access) return access.error;
  return json({ recommendations: await runtimeFromDeps(dependencies).listRecommendations(access.workspaceId, access.organizationId) });
}

export async function handleReviewFinanceRecommendation(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:review_recommendations", route: "/api/gba/finance/recommendations/review", dependencies });
  if ("error" in access) return access.error;
  const body = await parseBody(request);
  if (!body || typeof body.financeRecommendationId !== "string" || typeof body.decision !== "string") {
    return json({ error: "financeRecommendationId and decision are required." }, 400);
  }
  if (!["REVIEWED", "APPROVED", "REJECTED", "DISMISSED"].includes(body.decision)) {
    return json({ error: "decision must be REVIEWED|APPROVED|REJECTED|DISMISSED." }, 400);
  }

  return json({
    review: await runtimeFromDeps(dependencies).reviewRecommendation({
      workspaceId: access.workspaceId,
      organizationId: access.organizationId,
      actorId: access.actorId,
      financeRecommendationId: body.financeRecommendationId,
      decision: body.decision as "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED",
      notes: typeof body.notes === "string" ? body.notes : undefined,
    }),
  }, 201);
}

export async function handleFinanceExecutiveReports(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_executive_reports", route: "/api/gba/finance/executive-reports", dependencies });
  if ("error" in access) return access.error;
  return json({ reports: await runtimeFromDeps(dependencies).listExecutiveReports(access.workspaceId, access.organizationId) });
}

export async function handleFinanceHealth(request: Request, dependencies?: GbaFinanceApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:finance:view_health", route: "/api/gba/finance/health", dependencies });
  if ("error" in access) return access.error;
  return json({ health: await runtimeFromDeps(dependencies).listHealth(access.workspaceId, access.organizationId) });
}

export function createInMemoryFinanceApiDependencies(): GbaFinanceApiDependencies {
  return { repository: createInMemoryFinanceRepository(), sessionLoader: getGlwSession };
}
