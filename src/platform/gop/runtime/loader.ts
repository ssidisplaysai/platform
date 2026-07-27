import type { GenesisAuthorizationSubject, GenesisNavigationItem } from "../contracts";
import { getGenesisBootstrapManifests } from "./bootstrap-list";
import { bootstrapGenesisModules, type GenesisModuleBootstrapResult } from "./module-bootstrap";

const cacheByContext = new Map<string, GenesisModuleBootstrapResult>();

export type GenesisModuleLoaderContext = {
  subject?: GenesisAuthorizationSubject;
  workspaceId?: string;
};

function buildContextCacheKey(context: GenesisModuleLoaderContext): string {
  if (!context.subject) {
    return `public:${context.workspaceId ?? "none"}`;
  }

  const membershipKey = [...context.subject.workspaceMemberships]
    .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId))
    .map((membership) => `${membership.workspaceId}:${membership.role}:${membership.active ? "1" : "0"}`)
    .join("|");

  const permissionsKey = [...context.subject.permissions].sort().join("|");

  return [
    context.subject.actorId,
    context.subject.role,
    context.workspaceId ?? "none",
    membershipKey,
    permissionsKey,
  ].join("::");
}

export function loadGenesisModules(forceReload = false, context: GenesisModuleLoaderContext = {}): GenesisModuleBootstrapResult {
  const key = buildContextCacheKey(context);

  if (forceReload) {
    cacheByContext.delete(key);
  }

  const cached = cacheByContext.get(key);
  if (cached) {
    return cached;
  }

  const loaded = bootstrapGenesisModules(getGenesisBootstrapManifests(), {
    subject: context.subject,
    workspaceId: context.workspaceId,
  });

  cacheByContext.set(key, loaded);
  return loaded;
}

export function getGenesisNavigationItems(context: GenesisModuleLoaderContext = {}): GenesisNavigationItem[] {
  return loadGenesisModules(false, context).navigation;
}

export function getGenesisModuleBootstrapIssues(context: GenesisModuleLoaderContext = {}) {
  return loadGenesisModules(false, context).issues;
}
