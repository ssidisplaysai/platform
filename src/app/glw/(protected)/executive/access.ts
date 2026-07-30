import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gba.executive";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/executive": "gba:executive:view_dashboard",
  "/glw/executive/briefings": "gba:executive:view_briefings",
  "/glw/executive/goals": "gba:executive:view_goals",
  "/glw/executive/kpis": "gba:executive:view_kpis",
  "/glw/executive/recommendations": "gba:executive:view_recommendations",
  "/glw/executive/risks": "gba:executive:view_risks",
  "/glw/executive/opportunities": "gba:executive:view_opportunities",
  "/glw/executive/delegations": "gba:executive:delegate_work",
  "/glw/executive/health": "gba:executive:view_health",
  "/glw/executive/timeline": "gba:executive:view_dashboard",
  "/glw/executive/approvals": "gba:executive:view_dashboard",
};

export type GbaExecutiveRoutePermissions = {
  canViewDashboard: boolean;
  canViewBriefings: boolean;
  canGenerateBriefings: boolean;
  canViewKpis: boolean;
  canManageKpis: boolean;
  canViewGoals: boolean;
  canManageGoals: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canDelegateWork: boolean;
  canViewRisks: boolean;
  canManageRisks: boolean;
  canViewOpportunities: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaExecutivePermissions(route: string): Promise<GbaExecutiveRoutePermissions> {
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

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:executive:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewBriefings: authorize("gba:executive:view_briefings"),
    canGenerateBriefings: authorize("gba:executive:generate_briefings"),
    canViewKpis: authorize("gba:executive:view_kpis"),
    canManageKpis: authorize("gba:executive:manage_kpis"),
    canViewGoals: authorize("gba:executive:view_goals"),
    canManageGoals: authorize("gba:executive:manage_goals"),
    canViewRecommendations: authorize("gba:executive:view_recommendations"),
    canReviewRecommendations: authorize("gba:executive:review_recommendations"),
    canDelegateWork: authorize("gba:executive:delegate_work"),
    canViewRisks: authorize("gba:executive:view_risks"),
    canManageRisks: authorize("gba:executive:manage_risks"),
    canViewOpportunities: authorize("gba:executive:view_opportunities"),
    canViewHealth: authorize("gba:executive:view_health"),
  };
}
