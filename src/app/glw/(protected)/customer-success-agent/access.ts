import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gba.customer_success";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/customer-success-agent": "gba:customer_success:view_dashboard",
  "/glw/customer-success-agent/customer-health": "gba:customer_success:view_customer_health",
  "/glw/customer-success-agent/onboarding": "gba:customer_success:view_onboarding",
  "/glw/customer-success-agent/success-plans": "gba:customer_success:view_success_plans",
  "/glw/customer-success-agent/renewals": "gba:customer_success:view_renewals",
  "/glw/customer-success-agent/satisfaction": "gba:customer_success:view_satisfaction",
  "/glw/customer-success-agent/reports": "gba:customer_success:view_executive_reports",
  "/glw/customer-success-agent/kpis": "gba:customer_success:view_kpis",
  "/glw/customer-success-agent/recommendations": "gba:customer_success:view_recommendations",
  "/glw/customer-success-agent/timeline": "gba:customer_success:view_timeline",
  "/glw/customer-success-agent/health": "gba:customer_success:view_health",
  "/glw/customer-success-agent/settings": "gba:customer_success:view_dashboard",
};

export type GbaCustomerSuccessRoutePermissions = {
  canViewDashboard: boolean;
  canViewCustomerHealth: boolean;
  canViewOnboarding: boolean;
  canViewSuccessPlans: boolean;
  canViewRenewals: boolean;
  canViewSatisfaction: boolean;
  canViewExecutiveReports: boolean;
  canViewKpis: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewTimeline: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaCustomerSuccessPermissions(route: string): Promise<GbaCustomerSuccessRoutePermissions> {
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

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:customer_success:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewCustomerHealth: authorize("gba:customer_success:view_customer_health"),
    canViewOnboarding: authorize("gba:customer_success:view_onboarding"),
    canViewSuccessPlans: authorize("gba:customer_success:view_success_plans"),
    canViewRenewals: authorize("gba:customer_success:view_renewals"),
    canViewSatisfaction: authorize("gba:customer_success:view_satisfaction"),
    canViewExecutiveReports: authorize("gba:customer_success:view_executive_reports"),
    canViewKpis: authorize("gba:customer_success:view_kpis"),
    canViewRecommendations: authorize("gba:customer_success:view_recommendations"),
    canReviewRecommendations: authorize("gba:customer_success:review_recommendations"),
    canViewTimeline: authorize("gba:customer_success:view_timeline"),
    canViewHealth: authorize("gba:customer_success:view_health"),
  };
}
