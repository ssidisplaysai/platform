import { randomUUID } from "node:crypto";
import type { AIAuthorizationRequest } from "../contracts";
import type { AIAuthorizationResolver } from "../execution";
import type { GenesisAuthorizationSubject, GenesisPlatformRole } from "@/platform/gop/contracts";
import { createActionReference, createGenesisSubject } from "@/platform/gop/auth/resolver";
import { buildGenesisWorkspaceMemberships, getGenesisAuthorizationResolver } from "@/platform/gop/auth/authorization";

export type AIGenesisAuthorizationAdapterOptions = {
  moduleId?: string;
  defaultRole?: GenesisPlatformRole;
  resolveSubject?: (request: AIAuthorizationRequest) => GenesisAuthorizationSubject;
};

function buildDefaultSubject(request: AIAuthorizationRequest, role: GenesisPlatformRole): GenesisAuthorizationSubject {
  return createGenesisSubject({
    actorId: request.principalId,
    actorName: request.principalName,
    role,
    permissions: [],
    workspaceMemberships: buildGenesisWorkspaceMemberships(request.principalId, role),
  });
}

export function createGenesisAIAuthorizationResolver(options: AIGenesisAuthorizationAdapterOptions = {}): AIAuthorizationResolver {
  const resolver = getGenesisAuthorizationResolver();
  const moduleId = options.moduleId ?? "platform.ai";
  const defaultRole = options.defaultRole ?? "VIEWER";

  return (request) => {
    const subject = options.resolveSubject
      ? options.resolveSubject(request)
      : buildDefaultSubject(request, defaultRole);

    const action = createActionReference("ai.tool.execute", "job_action");
    const decision = resolver.authorize({
      subject,
      workspaceId: request.workspace,
      moduleId,
      action,
      resource: {
        workspaceId: request.workspace,
        moduleId,
        metadata: {
          tenant: request.tenant,
          agentId: request.agentId,
          toolId: request.toolId,
          requiredPermissions: request.requiredPermissions,
          ...(request.metadata ?? {}),
        },
      },
    });

    return {
      allowed: decision.allowed,
      reason: decision.reason,
      policyId: decision.policyId,
      cacheHit: false,
      evaluatedAt: new Date().toISOString(),
      provenance: {
        source: "GENESIS_AUTHORIZATION_RESOLVER" as const,
        principalId: request.principalId,
        actionId: action.actionId,
        workspaceId: request.workspace,
        requestId: `ai-auth-${randomUUID()}`,
      },
      grantedPermissions: decision.allowed ? [...request.requiredPermissions] : [],
    };
  };
}
