import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gba.finance";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/finance-agent": "gba:finance:view_dashboard",
  "/glw/finance-agent/general-ledger": "gba:finance:view_general_ledger",
  "/glw/finance-agent/accounts-receivable": "gba:finance:view_accounts_receivable",
  "/glw/finance-agent/accounts-payable": "gba:finance:view_accounts_payable",
  "/glw/finance-agent/budgets": "gba:finance:view_budgets",
  "/glw/finance-agent/profitability": "gba:finance:view_profitability",
  "/glw/finance-agent/forecasting": "gba:finance:view_forecasts",
  "/glw/finance-agent/reports": "gba:finance:view_executive_reports",
  "/glw/finance-agent/kpis": "gba:finance:view_kpis",
  "/glw/finance-agent/recommendations": "gba:finance:view_recommendations",
  "/glw/finance-agent/health": "gba:finance:view_health",
  "/glw/finance-agent/settings": "gba:finance:view_dashboard",
};

export type GbaFinanceRoutePermissions = {
  canViewDashboard: boolean;
  canViewGeneralLedger: boolean;
  canViewAccountsReceivable: boolean;
  canViewAccountsPayable: boolean;
  canViewBudgets: boolean;
  canManageBudgets: boolean;
  canViewProfitability: boolean;
  canViewForecasts: boolean;
  canViewKpis: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewExecutiveReports: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaFinancePermissions(route: string): Promise<GbaFinanceRoutePermissions> {
  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();

  const authorize = (actionId: string) => resolver.authorize({
    subject,
    workspaceId: WORKSPACE_ID,
    moduleId: MODULE_ID,
    action: createActionReference(actionId, "route_access"),
    resource: { workspaceId: WORKSPACE_ID, moduleId: MODULE_ID, route },
  }).allowed;

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:finance:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewGeneralLedger: authorize("gba:finance:view_general_ledger"),
    canViewAccountsReceivable: authorize("gba:finance:view_accounts_receivable"),
    canViewAccountsPayable: authorize("gba:finance:view_accounts_payable"),
    canViewBudgets: authorize("gba:finance:view_budgets"),
    canManageBudgets: authorize("gba:finance:manage_budgets"),
    canViewProfitability: authorize("gba:finance:view_profitability"),
    canViewForecasts: authorize("gba:finance:view_forecasts"),
    canViewKpis: authorize("gba:finance:view_kpis"),
    canViewRecommendations: authorize("gba:finance:view_recommendations"),
    canReviewRecommendations: authorize("gba:finance:review_recommendations"),
    canViewExecutiveReports: authorize("gba:finance:view_executive_reports"),
    canViewHealth: authorize("gba:finance:view_health"),
  };
}
