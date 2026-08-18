import type {
  GenesisAuthenticatedIdentity,
  GenesisAuthorizationSubject,
  GenesisPlatformRole,
  GenesisWorkspaceMembership,
} from "../contracts";
import { createActionReference, createGenesisAuthorizationResolver, createGenesisSubject } from "./resolver";
import { genesisDefaultPolicies } from "./policies";
import type { GenesisAuthorizationResolver } from "./resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "../workspaces/identity";

let resolver: GenesisAuthorizationResolver | null = null;

function configuredActors(name: string): Set<string> {
  return new Set((process.env[name] ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function inferRoleFromIdentity(identity: GenesisAuthenticatedIdentity): GenesisPlatformRole {
  const admin = process.env.GLW_ADMIN_EMAIL?.trim().toLowerCase();

  if (admin && identity.email === admin) {
    return "ADMINISTRATOR";
  }

  if (configuredActors("GLW_DELIVERY_RECOVERY_APPROVER_EMAILS").has(identity.email)) {
    return "MANAGER";
  }

  if (configuredActors("GLW_DELIVERY_OPERATOR_EMAILS").has(identity.email)) {
    return "OPERATOR";
  }

  return "VIEWER";
}

export function getGenesisAuthorizationResolver(): GenesisAuthorizationResolver {
  if (!resolver) {
    resolver = createGenesisAuthorizationResolver(genesisDefaultPolicies);
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
