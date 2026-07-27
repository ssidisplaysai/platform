import { geaId, nowIso } from "./agent-models";
import type { Tool, ToolAuthorization } from "./tool-models";

export type ToolAuthorizationInput = {
  tool: Tool;
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  agentId: string;
  actorId: string;
  role: string;
  runtimeState: string;
  capabilityPermissions: string[];
  permissionActions: string[];
};

export type ToolAuthorizationEngine = {
  evaluate: (input: ToolAuthorizationInput) => ToolAuthorization;
};

export function createToolAuthorizationEngine(): ToolAuthorizationEngine {
  return {
    evaluate(input) {
      const active = input.tool.versions.find((entry) => entry.versionTag === input.tool.activeVersionTag);
      if (!active) {
        return {
          authorizationId: geaId("geatoolauth"),
          toolId: input.tool.definition.toolId,
          toolVersionId: "unknown",
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          organizationId: input.organizationId,
          agentId: input.agentId,
          actorId: input.actorId,
          allowed: false,
          reason: "No active tool version is available.",
          permissionEvaluation: [],
          capabilityResolution: [],
          evaluatedAt: nowIso(),
        };
      }

      const requiredCapabilities = active.executionPolicy ? input.tool.definition.manifest.capabilityRequirements : [];
      const requiredPermissions = input.tool.definition.manifest.permissionRequirements;

      const missingCapabilities = requiredCapabilities.filter(
        (capability) => !input.capabilityPermissions.includes(`capability:${capability}`),
      );
      const missingPermissions = requiredPermissions.filter(
        (permission) => !input.permissionActions.includes(permission),
      );

      const allowed = input.runtimeState !== "CANCELLED"
        && input.tool.definition.lifecycleState === "ACTIVE"
        && missingCapabilities.length === 0
        && missingPermissions.length === 0;

      return {
        authorizationId: geaId("geatoolauth"),
        toolId: input.tool.definition.toolId,
        toolVersionId: active.toolVersionId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        actorId: input.actorId,
        allowed,
        reason: allowed
          ? "Allowed by tool lifecycle, capability, and permission policies."
          : "Default deny: lifecycle/capability/permission/runtime state check failed.",
        permissionEvaluation: requiredPermissions,
        capabilityResolution: requiredCapabilities,
        evaluatedAt: nowIso(),
      };
    },
  };
}
