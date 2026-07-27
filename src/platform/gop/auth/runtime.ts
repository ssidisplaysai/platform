import { createGenesisAuthorizationResolver, createGenesisSubject } from "./resolver";
import { genesisDefaultPolicies } from "./policies";
import type { GenesisAuthorizationResolver, } from "./resolver";
import type { GenesisPlatformRole, GenesisWorkspaceMembership } from "../contracts";

let resolver: GenesisAuthorizationResolver | null = null;

function inferRoleFromEmail(email: string): GenesisPlatformRole {
  const normalized = email.trim().toLowerCase();
  const admin = process.env.GLW_ADMIN_EMAIL?.trim().toLowerCase();

  if (admin && normalized === admin) {
    return "ADMINISTRATOR";
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
      workspaceId: "glw-led-display-warehouse",
      actorId,
      role,
      permissions: role === "VIEWER" ? ["read"] : ["read", "write", "admin"],
      active: true,
    },
  ];
}

export function buildGenesisSubjectFromSession(session: { email: string; expiresAt: number } | null) {
  if (!session) {
    return createGenesisSubject({
      actorId: "anonymous",
      actorName: "Anonymous",
      role: "VIEWER",
      permissions: [],
      workspaceMemberships: [],
    });
  }

  const role = inferRoleFromEmail(session.email);

  return createGenesisSubject({
    actorId: session.email,
    actorName: session.email,
    role,
    permissions: role === "VIEWER" ? ["read"] : ["read", "write", "admin", "metrics", "module.manage"],
    workspaceMemberships: buildGenesisWorkspaceMemberships(session.email, role),
  });
}
