import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_ID;
const MODULE_ID = "gea.orchestration";

export type GeaOrchestrationRoutePermissions = {
  canViewWorkflows: boolean;
  canExecuteWorkflows: boolean;
  canCancelWorkflows: boolean;
  canPauseWorkflows: boolean;
  canResumeWorkflows: boolean;
  canReplayWorkflows: boolean;
  canManageWorkflowDefinitions: boolean;
  canViewTimeline: boolean;
  canViewHealth: boolean;
  canApproveWorkflowStages: boolean;
};

export async function resolveGeaOrchestrationPermissions(route: string): Promise<GeaOrchestrationRoutePermissions> {
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

  const canView = authorize("gea:orchestration:view_workflows");
  if (!canView) {
    notFound();
  }

  return {
    canViewWorkflows: canView,
    canExecuteWorkflows: authorize("gea:orchestration:execute_workflows"),
    canCancelWorkflows: authorize("gea:orchestration:cancel_workflows"),
    canPauseWorkflows: authorize("gea:orchestration:pause_workflows"),
    canResumeWorkflows: authorize("gea:orchestration:resume_workflows"),
    canReplayWorkflows: authorize("gea:orchestration:replay_workflows"),
    canManageWorkflowDefinitions: authorize("gea:orchestration:manage_workflow_definitions"),
    canViewTimeline: authorize("gea:orchestration:view_timeline"),
    canViewHealth: authorize("gea:orchestration:view_health"),
    canApproveWorkflowStages: authorize("gea:orchestration:approve_workflow_stages"),
  };
}
