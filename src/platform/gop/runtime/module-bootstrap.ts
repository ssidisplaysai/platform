import {
  genesisJobTypes,
  type GenesisJobType,
  type GenesisAuthorizationSubject,
  type GenesisModuleManifest,
  type GenesisNavigationItem,
} from "../contracts";
import { createGenesisModuleRegistry, type GenesisModuleRegistry } from "../module-registry";
import { getGenesisAuthorizationResolver } from "../auth/runtime";
import { createActionReference } from "../auth/resolver";

export type GenesisModuleBootstrapIssue = {
  moduleId?: string;
  code:
    | "INVALID_MANIFEST"
    | "DUPLICATE_MODULE_ID"
    | "DUPLICATE_ROUTE_OWNERSHIP"
    | "INVALID_JOB_TYPE"
    | "DUPLICATE_NAV_ROUTE";
  message: string;
};

export type GenesisPermissionCheck = (permission: string) => boolean;

export type GenesisModuleBootstrapOptions = {
  hasPermission?: GenesisPermissionCheck;
  subject?: GenesisAuthorizationSubject;
  workspaceId?: string;
};

export type GenesisModuleBootstrapResult = {
  registry: GenesisModuleRegistry;
  enabledModules: GenesisModuleManifest[];
  navigation: GenesisNavigationItem[];
  issues: GenesisModuleBootstrapIssue[];
};

function hasValidManifestShape(manifest: GenesisModuleManifest): boolean {
  return Boolean(
    manifest
    && typeof manifest.moduleId === "string"
    && manifest.moduleId.trim().length > 0
    && typeof manifest.name === "string"
    && manifest.name.trim().length > 0
    && Array.isArray(manifest.navigation)
    && Array.isArray(manifest.routes)
    && Array.isArray(manifest.supportedJobTypes),
  );
}

function isSupportedJobType(jobType: string): jobType is GenesisJobType {
  return genesisJobTypes.includes(jobType as GenesisJobType);
}

function stableNavigationOrder(left: GenesisNavigationItem, right: GenesisNavigationItem): number {
  const leftOrder = left.order ?? 1000;
  const rightOrder = right.order ?? 1000;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.label.localeCompare(right.label);
}

export function bootstrapGenesisModules(
  manifests: GenesisModuleManifest[],
  options: GenesisModuleBootstrapOptions = {},
): GenesisModuleBootstrapResult {
  const issues: GenesisModuleBootstrapIssue[] = [];
  const registry = createGenesisModuleRegistry();
  const routeOwners = new Map<string, string>();
  const moduleIds = new Set<string>();

  for (const manifest of manifests) {
    if (!hasValidManifestShape(manifest)) {
      issues.push({
        moduleId: manifest?.moduleId,
        code: "INVALID_MANIFEST",
        message: "Manifest is missing required fields.",
      });
      continue;
    }

    if (moduleIds.has(manifest.moduleId)) {
      issues.push({
        moduleId: manifest.moduleId,
        code: "DUPLICATE_MODULE_ID",
        message: `Duplicate module id detected: ${manifest.moduleId}`,
      });
      continue;
    }

    const invalidType = manifest.supportedJobTypes.find((jobType) => !isSupportedJobType(jobType));

    if (invalidType) {
      issues.push({
        moduleId: manifest.moduleId,
        code: "INVALID_JOB_TYPE",
        message: `Unsupported job type declared by ${manifest.moduleId}: ${invalidType}`,
      });
      continue;
    }

    let hasRouteConflict = false;
    for (const route of manifest.routes) {
      const owner = routeOwners.get(route.href);
      if (owner && owner !== manifest.moduleId) {
        hasRouteConflict = true;
        issues.push({
          moduleId: manifest.moduleId,
          code: "DUPLICATE_ROUTE_OWNERSHIP",
          message: `Route ${route.href} is already owned by module ${owner}.`,
        });
      }
    }

    if (hasRouteConflict) {
      continue;
    }

    moduleIds.add(manifest.moduleId);
    for (const route of manifest.routes) {
      routeOwners.set(route.href, manifest.moduleId);
    }

    registry.register(manifest);
  }

  const permissionCheck = options.hasPermission;
  const resolver = getGenesisAuthorizationResolver();

  const enabledModules = registry
    .list()
    .filter((manifest) => manifest.enabled !== false)
    .filter((manifest) => {
      if (!options.subject) {
        return true;
      }

      const decision = resolver.authorize({
        subject: options.subject,
        workspaceId: options.workspaceId,
        moduleId: manifest.moduleId,
        route: undefined,
        action: createActionReference("module:view", "module_visibility"),
        resource: {
          workspaceId: options.workspaceId,
          moduleId: manifest.moduleId,
        },
      });

      return decision.allowed;
    })
    .sort((left, right) => {
      const leftOrder = left.order ?? 1000;
      const rightOrder = right.order ?? 1000;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name);
    });

  const seenNavigationHrefs = new Set<string>();
  const navigation: GenesisNavigationItem[] = [];

  for (const manifest of enabledModules) {
    for (const nav of manifest.navigation) {
      if (nav.enabled === false) {
        continue;
      }

      if (nav.permission && permissionCheck && !permissionCheck(nav.permission)) {
        continue;
      }

      if (options.subject) {
        const routeDecision = resolver.authorize({
          subject: options.subject,
          workspaceId: options.workspaceId,
          moduleId: manifest.moduleId,
          route: nav.href,
          action: createActionReference("route:view", "route_access"),
          resource: {
            workspaceId: options.workspaceId,
            moduleId: manifest.moduleId,
            route: nav.href,
          },
        });

        if (!routeDecision.allowed) {
          continue;
        }
      }

      if (seenNavigationHrefs.has(nav.href)) {
        issues.push({
          moduleId: manifest.moduleId,
          code: "DUPLICATE_NAV_ROUTE",
          message: `Navigation href is duplicated: ${nav.href}`,
        });
        continue;
      }

      seenNavigationHrefs.add(nav.href);
      navigation.push(nav);
    }
  }

  navigation.sort(stableNavigationOrder);

  return {
    registry,
    enabledModules,
    navigation,
    issues,
  };
}
