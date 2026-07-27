import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

const WORKSPACE_ID = "glw-led-display-warehouse";
const MODULE_ID = "gea.runtime";

export type GeaRoutePermissions = {
  canViewAgents: boolean;
  canExecuteAgents: boolean;
  canReplayExecutions: boolean;
  canApprovePlans: boolean;
  canManageCapabilities: boolean;
  canManageTools: boolean;
  canViewAudit: boolean;
  canViewMemory: boolean;
  canManageContext: boolean;
  canViewHealth: boolean;
};

export async function resolveGeaPermissions(route: string): Promise<GeaRoutePermissions> {
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

  const canView = authorize("gea:agents:view");
  if (!canView) {
    notFound();
  }

  return {
    canViewAgents: canView,
    canExecuteAgents: authorize("gea:agents:execute"),
    canReplayExecutions: authorize("gea:agents:replay"),
    canApprovePlans: authorize("gea:agents:approve_plans"),
    canManageCapabilities: authorize("gea:agents:manage_capabilities"),
    canManageTools: authorize("gea:agents:manage_tools"),
    canViewAudit: authorize("gea:agents:view_audit"),
    canViewMemory: authorize("gea:agents:view_memory"),
    canManageContext: authorize("gea:agents:manage_context"),
    canViewHealth: authorize("gea:agents:view_health"),
  };
}
