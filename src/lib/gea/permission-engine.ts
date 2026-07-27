import type { AgentPermission } from "./agent-models";
import { geaId, nowIso } from "./agent-models";

export type PermissionInput = {
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  role: string;
  capabilityKey: string;
  toolKey?: string;
  runtimeState: string;
  allowedActions: string[];
};

export type PermissionEngine = {
  evaluate: (input: PermissionInput) => AgentPermission;
};

export function createPermissionEngine(): PermissionEngine {
  return {
    evaluate(input) {
      const actionCapability = `capability:${input.capabilityKey}`;
      const actionTool = input.toolKey ? `tool:${input.toolKey}` : null;
      const approved = input.allowedActions.includes(actionCapability)
        && (actionTool ? input.allowedActions.includes(actionTool) : true)
        && input.runtimeState !== "CANCELLED";

      return {
        permissionId: geaId("geaperm"),
        capabilityKey: input.capabilityKey,
        toolKey: input.toolKey,
        resourceScope: input.projectId ? "PROJECT" : (input.organizationId ? "ORGANIZATION" : "WORKSPACE"),
        allowed: approved,
        reason: approved ? "Allowed by capability and tool policy." : "Default deny: missing capability/tool policy or invalid runtime state.",
        evaluatedAt: nowIso(),
      };
    },
  };
}
