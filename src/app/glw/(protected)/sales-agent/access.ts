import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gba.sales";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/sales-agent": "gba:sales:view_dashboard",
  "/glw/sales-agent/pipeline": "gba:sales:view_pipeline",
  "/glw/sales-agent/forecasting": "gba:sales:view_forecasting",
  "/glw/sales-agent/accounts": "gba:sales:view_accounts",
  "/glw/sales-agent/recommendations": "gba:sales:view_recommendations",
  "/glw/sales-agent/timeline": "gba:sales:view_dashboard",
  "/glw/sales-agent/health": "gba:sales:view_health",
};

export type GbaSalesRoutePermissions = {
  canViewDashboard: boolean;
  canViewPipeline: boolean;
  canManagePipeline: boolean;
  canViewForecasting: boolean;
  canViewAccounts: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaSalesPermissions(route: string): Promise<GbaSalesRoutePermissions> {
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

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:sales:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewPipeline: authorize("gba:sales:view_pipeline"),
    canManagePipeline: authorize("gba:sales:manage_pipeline"),
    canViewForecasting: authorize("gba:sales:view_forecasting"),
    canViewAccounts: authorize("gba:sales:view_accounts"),
    canViewRecommendations: authorize("gba:sales:view_recommendations"),
    canReviewRecommendations: authorize("gba:sales:review_recommendations"),
    canViewHealth: authorize("gba:sales:view_health"),
  };
}
