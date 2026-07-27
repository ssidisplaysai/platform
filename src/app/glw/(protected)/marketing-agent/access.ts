import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

const WORKSPACE_ID = "glw-led-display-warehouse";
const MODULE_ID = "gba.marketing";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/marketing-agent": "gba:marketing:view_dashboard",
  "/glw/marketing-agent/campaigns": "gba:marketing:view_campaigns",
  "/glw/marketing-agent/strategy": "gba:marketing:view_strategy",
  "/glw/marketing-agent/seo": "gba:marketing:view_seo",
  "/glw/marketing-agent/brand-governance": "gba:marketing:view_brand_governance",
  "/glw/marketing-agent/analytics": "gba:marketing:view_analytics",
  "/glw/marketing-agent/recommendations": "gba:marketing:view_recommendations",
  "/glw/marketing-agent/timeline": "gba:marketing:view_dashboard",
  "/glw/marketing-agent/health": "gba:marketing:view_health",
  "/glw/marketing-agent/executive-reports": "gba:marketing:view_dashboard",
};

export type GbaMarketingRoutePermissions = {
  canViewDashboard: boolean;
  canViewCampaigns: boolean;
  canManageCampaigns: boolean;
  canViewStrategy: boolean;
  canManageStrategy: boolean;
  canViewSeo: boolean;
  canViewBrandGovernance: boolean;
  canManageBrandGovernance: boolean;
  canViewAnalytics: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaMarketingPermissions(route: string): Promise<GbaMarketingRoutePermissions> {
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

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:marketing:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewCampaigns: authorize("gba:marketing:view_campaigns"),
    canManageCampaigns: authorize("gba:marketing:manage_campaigns"),
    canViewStrategy: authorize("gba:marketing:view_strategy"),
    canManageStrategy: authorize("gba:marketing:manage_strategy"),
    canViewSeo: authorize("gba:marketing:view_seo"),
    canViewBrandGovernance: authorize("gba:marketing:view_brand_governance"),
    canManageBrandGovernance: authorize("gba:marketing:manage_brand_governance"),
    canViewAnalytics: authorize("gba:marketing:view_analytics"),
    canViewRecommendations: authorize("gba:marketing:view_recommendations"),
    canReviewRecommendations: authorize("gba:marketing:review_recommendations"),
    canViewHealth: authorize("gba:marketing:view_health"),
  };
}
