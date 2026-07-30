import type {
  GenesisAuthenticatedIdentity,
  GenesisAuthorizationDecision,
  GenesisAuthorizationRequest,
  GenesisAuthorizationSubject,
  GenesisPlatformRole,
  GenesisPolicy,
  GenesisWorkspaceMembership,
} from "../contracts";
import { randomUUID } from "node:crypto";
import {
  AuthorizationService,
  StaticAuthorizationProvider,
  type AuthorizationContext,
  type AuthorizationPolicy,
} from "@/platform/identity/authorization";
import { createActionReference, createGenesisSubject } from "./resolver";
import { genesisDefaultPolicies } from "./policies";
import type { GenesisAuthorizationResolver } from "./resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "../workspaces/identity";

let resolver: GenesisAuthorizationResolver | null = null;
let authorizationService: AuthorizationService | null = null;

function mapPolicy(policy: GenesisPolicy, index: number): AuthorizationPolicy {
  return {
    policyId: policy.policyId,
    description: policy.description,
    effect: policy.effect === "allow" ? "ALLOW" : "DENY",
    priority: Math.max(1, 10_000 - index),
    active: true,
    roles: policy.roles,
    permissions: policy.permissions,
    workspaceIds: policy.workspaceIds,
    moduleIds: policy.moduleIds,
    actions: policy.actions,
    jobTypes: policy.jobTypes,
    jobStatuses: policy.jobStatuses,
    extensionIds: policy.extensionIds,
  };
}

function buildAuthorizationContext(request: GenesisAuthorizationRequest): AuthorizationContext {
  return {
    requestId: randomUUID(),
    principalId: request.subject.actorId,
    principalName: request.subject.actorName,
    actionId: request.action.actionId,
    actionType: request.action.type,
    workspaceId: request.workspaceId,
    moduleId: request.moduleId,
    jobType: request.jobType,
    jobStatus: request.jobStatus,
    roles: [request.subject.role],
    memberships: request.subject.workspaceMemberships,
    permissionSet: {
      directPermissions: request.subject.permissions,
      inheritedPermissions: [],
      capabilityPermissions: [],
      workspacePermissions: [],
      resourcePermissions: [],
    },
    capabilities: [],
    resource: {
      resourceType: request.route ? "PAGE" : request.resource.jobId ? "WORK_ORDER" : "GENERIC",
      resourceId: request.resource.jobId,
      ownerActorId: request.resource.ownerActorId,
      workspaceId: request.resource.workspaceId,
      moduleId: request.resource.moduleId,
      extensionId: request.resource.extensionId,
      route: request.resource.route,
      metadata: request.resource.metadata,
    },
    contractVersion: "1.0.0",
    requestedAt: new Date().toISOString(),
  };
}

function mapDecision(request: GenesisAuthorizationRequest, contextDecision: ReturnType<AuthorizationService["authorize"]>): GenesisAuthorizationDecision {
  return {
    allowed: contextDecision.allowed,
    denied: !contextDecision.allowed,
    reasonCode: contextDecision.reasonCode,
    reason: contextDecision.reason,
    policyId: contextDecision.policyId,
    subject: request.subject,
    resource: request.resource,
    action: request.action,
  };
}

export function getGenesisAuthorizationService(): AuthorizationService {
  if (!authorizationService) {
    authorizationService = new AuthorizationService(
      new StaticAuthorizationProvider(genesisDefaultPolicies.map(mapPolicy)),
      { cacheTtlMs: 30_000 },
    );
  }

  return authorizationService;
}

function inferRoleFromIdentity(identity: GenesisAuthenticatedIdentity): GenesisPlatformRole {
  const admin = process.env.GLW_ADMIN_EMAIL?.trim().toLowerCase();

  if (admin && identity.email === admin) {
    return "ADMINISTRATOR";
  }

  return "VIEWER";
}

export function getGenesisAuthorizationResolver(): GenesisAuthorizationResolver {
  if (!resolver) {
    resolver = {
      authorize(request) {
        const context = buildAuthorizationContext(request);
        const decision = getGenesisAuthorizationService().authorize(context);
        return mapDecision(request, decision);
      },
      getPolicies() {
        return [...genesisDefaultPolicies];
      },
    };
  }

  return resolver;
}

export function buildGenesisWorkspaceMemberships(actorId: string, role: GenesisPlatformRole): GenesisWorkspaceMembership[] {
  return [
    {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      actorId,
      role,
      permissions: role === "VIEWER" ? ["read"] : ["read", "write", "admin"],
      active: true,
    },
  ];
}

export function createGenesisAuthorizationSubjectFromIdentity(
  identity: GenesisAuthenticatedIdentity | null,
): GenesisAuthorizationSubject {
  if (!identity) {
    return createGenesisSubject({
      actorId: "anonymous",
      actorName: "Anonymous",
      role: "VIEWER",
      permissions: [],
      workspaceMemberships: [],
    });
  }

  const role = inferRoleFromIdentity(identity);

  return createGenesisSubject({
    actorId: identity.actorId,
    actorName: identity.actorName,
    role,
    permissions: role === "VIEWER" ? ["read"] : ["read", "write", "admin", "metrics", "module.manage"],
    workspaceMemberships: buildGenesisWorkspaceMemberships(identity.actorId, role),
  });
}

export function isAuthorizationSubjectAllowedForRoute(input: {
  subject: GenesisAuthorizationSubject;
  workspaceId: string;
  moduleId: string;
  route: string;
}) {
  const decision = getGenesisAuthorizationResolver().authorize({
    subject: input.subject,
    workspaceId: input.workspaceId,
    moduleId: input.moduleId,
    route: input.route,
    action: createActionReference("route:view", "route_access"),
    resource: {
      workspaceId: input.workspaceId,
      moduleId: input.moduleId,
      route: input.route,
    },
  });

  return decision.allowed;
}
