import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gba.manufacturing";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/manufacturing-agent": "gba:manufacturing:view_dashboard",
  "/glw/manufacturing-agent/boms": "gba:manufacturing:view_boms",
  "/glw/manufacturing-agent/routings": "gba:manufacturing:view_routings",
  "/glw/manufacturing-agent/production-orders": "gba:manufacturing:view_production_orders",
  "/glw/manufacturing-agent/machines": "gba:manufacturing:view_machines",
  "/glw/manufacturing-agent/labor": "gba:manufacturing:view_labor",
  "/glw/manufacturing-agent/materials": "gba:manufacturing:view_materials",
  "/glw/manufacturing-agent/quality": "gba:manufacturing:view_quality",
  "/glw/manufacturing-agent/costing": "gba:manufacturing:view_costing",
  "/glw/manufacturing-agent/kpis": "gba:manufacturing:view_kpis",
  "/glw/manufacturing-agent/recommendations": "gba:manufacturing:view_recommendations",
  "/glw/manufacturing-agent/timeline": "gba:manufacturing:view_dashboard",
  "/glw/manufacturing-agent/health": "gba:manufacturing:view_health",
};

export type GbaManufacturingRoutePermissions = {
  canViewDashboard: boolean;
  canViewBoms: boolean;
  canViewRoutings: boolean;
  canViewProductionOrders: boolean;
  canManageProductionOrders: boolean;
  canViewMachines: boolean;
  canManageMachines: boolean;
  canViewLabor: boolean;
  canViewMaterials: boolean;
  canViewQuality: boolean;
  canManageQuality: boolean;
  canViewCosting: boolean;
  canViewKpis: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaManufacturingPermissions(route: string): Promise<GbaManufacturingRoutePermissions> {
  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();

  const authorize = (actionId: string) =>
    resolver.authorize({
      subject,
      workspaceId: WORKSPACE_ID,
      moduleId: MODULE_ID,
      action: createActionReference(actionId, "route_access"),
      resource: { workspaceId: WORKSPACE_ID, moduleId: MODULE_ID, route },
    }).allowed;

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:manufacturing:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewBoms: authorize("gba:manufacturing:view_boms"),
    canViewRoutings: authorize("gba:manufacturing:view_routings"),
    canViewProductionOrders: authorize("gba:manufacturing:view_production_orders"),
    canManageProductionOrders: authorize("gba:manufacturing:manage_production_orders"),
    canViewMachines: authorize("gba:manufacturing:view_machines"),
    canManageMachines: authorize("gba:manufacturing:manage_machines"),
    canViewLabor: authorize("gba:manufacturing:view_labor"),
    canViewMaterials: authorize("gba:manufacturing:view_materials"),
    canViewQuality: authorize("gba:manufacturing:view_quality"),
    canManageQuality: authorize("gba:manufacturing:manage_quality"),
    canViewCosting: authorize("gba:manufacturing:view_costing"),
    canViewKpis: authorize("gba:manufacturing:view_kpis"),
    canViewRecommendations: authorize("gba:manufacturing:view_recommendations"),
    canReviewRecommendations: authorize("gba:manufacturing:review_recommendations"),
    canViewHealth: authorize("gba:manufacturing:view_health"),
  };
}
