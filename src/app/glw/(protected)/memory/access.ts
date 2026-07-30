import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gea.memory";

export type GeaMemoryRoutePermissions = {
  canViewMemory: boolean;
  canBuildContext: boolean;
  canReplayContext: boolean;
  canViewProvenance: boolean;
  canManageRegistry: boolean;
  canViewCache: boolean;
  canValidateContext: boolean;
  canViewHealth: boolean;
};

export async function resolveGeaMemoryPermissions(route: string): Promise<GeaMemoryRoutePermissions> {
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

  const canView = authorize("gea:memory:view");
  if (!canView) {
    notFound();
  }

  return {
    canViewMemory: canView,
    canBuildContext: authorize("gea:context:build"),
    canReplayContext: authorize("gea:context:replay"),
    canViewProvenance: authorize("gea:context:view_provenance"),
    canManageRegistry: authorize("gea:memory:manage_registry"),
    canViewCache: authorize("gea:context:view_cache"),
    canValidateContext: authorize("gea:context:validate"),
    canViewHealth: authorize("gea:context:view_health"),
  };
}
