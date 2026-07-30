import type { AuthorizationContext } from "./AuthorizationContext";
import type { AuthorizationDecision } from "./AuthorizationDecision";
import type { AuthorizationPolicy } from "./AuthorizationPolicy";
import type { Role } from "./AuthorizationContext";
import type { Capability } from "./AuthorizationContext";

function hasIntersection(expected: string[] | undefined, actual: string | undefined): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  if (!actual) {
    return false;
  }

  return expected.includes(actual);
}

function hasAnyIntersection(expected: string[] | undefined, actual: string[]): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  if (actual.length === 0) {
    return false;
  }

  return actual.some((value) => expected.includes(value) || value === "*");
}

const roleOrder: Record<string, number> = {
  VIEWER: 10,
  CONTRIBUTOR: 15,
  OPERATOR: 20,
  MANAGER: 30,
  WORKSPACE_ADMINISTRATOR: 35,
  ADMINISTRATOR: 40,
  DEVELOPER: 50,
  SYSTEM: 60,
};

function roleSatisfies(roleIds: string[], requiredRoles: string[] | undefined): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (roleIds.length === 0) {
    return false;
  }

  return requiredRoles.some((requiredRole) => {
    const threshold = roleOrder[requiredRole] ?? 0;
    return roleIds.some((roleId) => (roleOrder[roleId] ?? 0) >= threshold);
  });
}

function rolesToIds(roles: Role[]): string[] {
  return roles.map((role) => role.roleId);
}

function capabilitiesToIds(capabilities: Capability[]): string[] {
  return capabilities.map((capability) => capability.capabilityId);
}

function buildDecision(input: {
  context: AuthorizationContext;
  allowed: boolean;
  reasonCode: AuthorizationDecision["reasonCode"];
  reason: string;
  policyId: string;
  grants?: string[];
  denials?: string[];
  cacheHit: boolean;
  latencyMs: number;
}): AuthorizationDecision {
  return {
    decisionId: `${input.context.requestId}:${input.policyId}`,
    result: input.allowed ? "ALLOW" : "DENY",
    allowed: input.allowed,
    reasonCode: input.reasonCode,
    reason: input.reason,
    policyId: input.policyId,
    principalId: input.context.principalId,
    actionId: input.context.actionId,
    workspaceId: input.context.workspaceId,
    resourceType: input.context.resource.resourceType,
    grants: input.grants ?? [],
    denials: input.denials ?? [],
    cacheHit: input.cacheHit,
    evaluatedAt: new Date().toISOString(),
    latencyMs: input.latencyMs,
  };
}

function matchesPolicy(context: AuthorizationContext, policy: AuthorizationPolicy, roleIds: string[], capabilityIds: string[]): boolean {
  if (!policy.active) {
    return false;
  }

  if (!roleSatisfies(roleIds, policy.roles)) {
    return false;
  }

  if (!hasIntersection(policy.workspaceIds, context.workspaceId)) {
    return false;
  }

  if (!hasIntersection(policy.moduleIds, context.moduleId)) {
    return false;
  }

  if (!hasIntersection(policy.actions, context.actionId)) {
    return false;
  }

  if (!hasIntersection(policy.jobTypes, context.jobType)) {
    return false;
  }

  if (!hasIntersection(policy.jobStatuses, context.jobStatus)) {
    return false;
  }

  if (!hasIntersection(policy.extensionIds, context.resource.extensionId)) {
    return false;
  }

  if (!hasAnyIntersection(policy.capabilities, capabilityIds)) {
    return false;
  }

  if (policy.resourceTypes && policy.resourceTypes.length > 0 && !policy.resourceTypes.includes(context.resource.resourceType)) {
    return false;
  }

  const allPermissions = [
    ...context.permissionSet.directPermissions,
    ...context.permissionSet.inheritedPermissions,
    ...context.permissionSet.capabilityPermissions,
    ...context.permissionSet.workspacePermissions,
    ...context.permissionSet.resourcePermissions,
  ];

  if (!hasAnyIntersection(policy.permissions, allPermissions)) {
    return false;
  }

  return true;
}

export class PolicyEngine {
  evaluate(input: {
    context: AuthorizationContext;
    roles: Role[];
    capabilities: Capability[];
    policies: AuthorizationPolicy[];
    cacheHit: boolean;
    startedAtMs: number;
  }): AuthorizationDecision {
    const roleIds = rolesToIds(input.roles);
    const capabilityIds = capabilitiesToIds(input.capabilities);

    const matchingPolicies = input.policies
      .filter((policy) => matchesPolicy(input.context, policy, roleIds, capabilityIds))
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return right.priority - left.priority;
        }

        return left.policyId.localeCompare(right.policyId);
      });

    const latencyMs = Date.now() - input.startedAtMs;

    const denyPolicy = matchingPolicies.find((policy) => policy.effect === "DENY");
    if (denyPolicy) {
      return buildDecision({
        context: input.context,
        allowed: false,
        reasonCode: "DENIED_POLICY",
        reason: `Policy ${denyPolicy.policyId} denied the request.`,
        policyId: denyPolicy.policyId,
        denials: [denyPolicy.policyId],
        cacheHit: input.cacheHit,
        latencyMs,
      });
    }

    const allowPolicy = matchingPolicies.find((policy) => policy.effect === "ALLOW");
    if (allowPolicy) {
      return buildDecision({
        context: input.context,
        allowed: true,
        reasonCode: "ALLOWED",
        reason: `Policy ${allowPolicy.policyId} allowed the request.`,
        policyId: allowPolicy.policyId,
        grants: [allowPolicy.policyId],
        cacheHit: input.cacheHit,
        latencyMs,
      });
    }

    return buildDecision({
      context: input.context,
      allowed: false,
      reasonCode: "DENIED_DEFAULT",
      reason: "No policy allowed this request.",
      policyId: "default-deny",
      cacheHit: input.cacheHit,
      latencyMs,
    });
  }
}
