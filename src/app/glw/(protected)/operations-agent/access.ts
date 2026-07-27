import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

const WORKSPACE_ID = "glw-led-display-warehouse";
const MODULE_ID = "gba.operations";

const ROUTE_ACTION_MAP: Record<string, string> = {
  "/glw/operations-agent": "gba:operations:view_dashboard",
  "/glw/operations-agent/work-orders": "gba:operations:view_work_orders",
  "/glw/operations-agent/production": "gba:operations:view_capacity",
  "/glw/operations-agent/warehouse": "gba:operations:view_warehouse",
  "/glw/operations-agent/inventory": "gba:operations:view_inventory",
  "/glw/operations-agent/purchasing": "gba:operations:view_purchasing",
  "/glw/operations-agent/shipping": "gba:operations:view_shipping",
  "/glw/operations-agent/capacity": "gba:operations:view_capacity",
  "/glw/operations-agent/kpis": "gba:operations:view_kpis",
  "/glw/operations-agent/recommendations": "gba:operations:view_recommendations",
  "/glw/operations-agent/vendors": "gba:operations:view_purchasing",
  "/glw/operations-agent/timeline": "gba:operations:view_dashboard",
  "/glw/operations-agent/health": "gba:operations:view_health",
};

export type GbaOperationsRoutePermissions = {
  canViewDashboard: boolean;
  canViewWorkOrders: boolean;
  canManageWorkOrders: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canViewPurchasing: boolean;
  canManagePurchasing: boolean;
  canViewWarehouse: boolean;
  canManageWarehouse: boolean;
  canViewShipping: boolean;
  canManageShipping: boolean;
  canViewCapacity: boolean;
  canViewKpis: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canViewHealth: boolean;
};

export async function resolveGbaOperationsPermissions(route: string): Promise<GbaOperationsRoutePermissions> {
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

  const requiredAction = ROUTE_ACTION_MAP[route] ?? "gba:operations:view_dashboard";
  const canView = authorize(requiredAction);
  if (!canView) {
    notFound();
  }

  return {
    canViewDashboard: canView,
    canViewWorkOrders: authorize("gba:operations:view_work_orders"),
    canManageWorkOrders: authorize("gba:operations:manage_work_orders"),
    canViewInventory: authorize("gba:operations:view_inventory"),
    canManageInventory: authorize("gba:operations:manage_inventory"),
    canViewPurchasing: authorize("gba:operations:view_purchasing"),
    canManagePurchasing: authorize("gba:operations:manage_purchasing"),
    canViewWarehouse: authorize("gba:operations:view_warehouse"),
    canManageWarehouse: authorize("gba:operations:manage_warehouse"),
    canViewShipping: authorize("gba:operations:view_shipping"),
    canManageShipping: authorize("gba:operations:manage_shipping"),
    canViewCapacity: authorize("gba:operations:view_capacity"),
    canViewKpis: authorize("gba:operations:view_kpis"),
    canViewRecommendations: authorize("gba:operations:view_recommendations"),
    canReviewRecommendations: authorize("gba:operations:review_recommendations"),
    canViewHealth: authorize("gba:operations:view_health"),
  };
}
