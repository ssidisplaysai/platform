import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gea.tools";

export type GeaToolRoutePermissions = {
  canViewTools: boolean;
  canExecuteTools: boolean;
  canReplayExecutions: boolean;
  canViewAudit: boolean;
  canManageRegistry: boolean;
  canManageVersions: boolean;
  canViewHealth: boolean;
  canValidateTools: boolean;
};

export async function resolveGeaToolPermissions(route: string): Promise<GeaToolRoutePermissions> {
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

  const canView = authorize("gea:tools:view");
  if (!canView) {
    notFound();
  }

  return {
    canViewTools: canView,
    canExecuteTools: authorize("gea:tools:execute"),
    canReplayExecutions: authorize("gea:tools:replay"),
    canViewAudit: authorize("gea:tools:view_audit"),
    canManageRegistry: authorize("gea:tools:manage_registry"),
    canManageVersions: authorize("gea:tools:manage_versions"),
    canViewHealth: authorize("gea:tools:view_health"),
    canValidateTools: authorize("gea:tools:validate"),
  };
}
