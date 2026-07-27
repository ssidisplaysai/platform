import type {
  GenesisActionReference,
  GenesisAuthorizationDecision,
  GenesisAuthorizationRequest,
  GenesisAuthorizationSubject,
  GenesisPlatformRole,
  GenesisPolicy,
} from "../contracts";

const roleOrder: Record<GenesisPlatformRole, number> = {
  VIEWER: 10,
  OPERATOR: 20,
  MANAGER: 30,
  ADMINISTRATOR: 40,
  DEVELOPER: 50,
  SYSTEM: 60,
};

function hasAnyIntersection(values: string[] | undefined, expected: string | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!expected) {
    return false;
  }

  return values.includes(expected);
}

function hasAnyArrayIntersection(values: string[] | undefined, expected: string[] | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!expected || expected.length === 0) {
    return false;
  }

  return expected.some((item) => values.includes(item));
}

function roleSatisfies(subjectRole: GenesisPlatformRole, requiredRoles: GenesisPlatformRole[] | undefined): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some((requiredRole) => roleOrder[subjectRole] >= roleOrder[requiredRole]);
}

function requestMatchesPolicy(request: GenesisAuthorizationRequest, policy: GenesisPolicy): boolean {
  if (!roleSatisfies(request.subject.role, policy.roles)) {
    return false;
  }

  if (!hasAnyIntersection(policy.workspaceIds, request.workspaceId)) {
    return false;
  }

  if (!hasAnyIntersection(policy.moduleIds, request.moduleId)) {
    return false;
  }

  if (!hasAnyIntersection(policy.actions, request.action.actionId)) {
    return false;
  }

  if (!hasAnyIntersection(policy.extensionIds, request.resource.extensionId)) {
    return false;
  }

  if (policy.jobTypes && policy.jobTypes.length > 0) {
    if (!request.jobType || !policy.jobTypes.includes(request.jobType)) {
      return false;
    }
  }

  if (policy.jobStatuses && policy.jobStatuses.length > 0) {
    if (!request.jobStatus || !policy.jobStatuses.includes(request.jobStatus)) {
      return false;
    }
  }

  if (policy.permissions && policy.permissions.length > 0) {
    if (!hasAnyArrayIntersection(policy.permissions, request.subject.permissions)) {
      return false;
    }
  }

  return true;
}

function buildDecision(
  allowed: boolean,
  request: GenesisAuthorizationRequest,
  reasonCode: GenesisAuthorizationDecision["reasonCode"],
  reason: string,
  policyId: string,
): GenesisAuthorizationDecision {
  return {
    allowed,
    denied: !allowed,
    reasonCode,
    reason,
    policyId,
    subject: request.subject,
    resource: request.resource,
    action: request.action,
  };
}

export type GenesisAuthorizationResolver = {
  authorize: (request: GenesisAuthorizationRequest) => GenesisAuthorizationDecision;
  getPolicies: () => GenesisPolicy[];
};

export function createGenesisAuthorizationResolver(policies: GenesisPolicy[]): GenesisAuthorizationResolver {
  return {
    authorize(request: GenesisAuthorizationRequest): GenesisAuthorizationDecision {
      const membershipSatisfied = request.workspaceId
        ? request.subject.workspaceMemberships.some(
            (membership) => membership.workspaceId === request.workspaceId && membership.active,
          )
        : true;

      if (!membershipSatisfied) {
        return buildDecision(false, request, "DENIED_WORKSPACE", "Actor is not a member of the workspace.", "workspace-membership");
      }

      if (
        request.resource.ownerActorId
        && request.subject.role === "VIEWER"
        && request.resource.ownerActorId !== request.subject.actorId
      ) {
        return buildDecision(false, request, "DENIED_OWNERSHIP", "Viewer role can only access owned resources.", "ownership-guard");
      }

      for (const policy of policies) {
        if (!requestMatchesPolicy(request, policy)) {
          continue;
        }

        if (policy.effect === "deny") {
          return buildDecision(false, request, "DENIED_POLICY", `Policy ${policy.policyId} denied the request.`, policy.policyId);
        }

        return buildDecision(true, request, "ALLOWED", `Policy ${policy.policyId} allowed the request.`, policy.policyId);
      }

      return buildDecision(false, request, "DENIED_DEFAULT", "No policy allowed this request.", "default-deny");
    },

    getPolicies() {
      return [...policies];
    },
  };
}

export function createGenesisSubject(input: {
  actorId: string;
  actorName?: string;
  role: GenesisPlatformRole;
  permissions?: string[];
  workspaceMemberships?: GenesisAuthorizationSubject["workspaceMemberships"];
}): GenesisAuthorizationSubject {
  return {
    actorId: input.actorId,
    actorName: input.actorName,
    role: input.role,
    permissions: input.permissions ?? [],
    workspaceMemberships: input.workspaceMemberships ?? [],
  };
}

export function createActionReference(actionId: string, type: GenesisActionReference["type"]): GenesisActionReference {
  return {
    actionId,
    type,
  };
}
