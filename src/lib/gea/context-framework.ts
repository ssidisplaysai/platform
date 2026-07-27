import { nowIso, stableChecksum } from "./agent-models";
import {
  createContextCacheKey,
  createContextIds,
  createSourceVersionFingerprint,
  currentAssemblyVersion,
  currentRuntimeVersion,
  defaultContextPolicy,
  deterministicSortReferences,
  type ContextCache,
  type ContextDependency,
  type ContextHealth,
  type ContextPackage,
  type ContextReplay,
  type ContextSection,
  type ContextTimeline,
  type ContextValidation,
  type MemoryReference,
} from "./memory-models";
import type { MemoryRepository } from "./memory-repository";
import type { MemoryRegistryService, MemoryResolver } from "./memory-registry";

export type ContextBuilderService = {
  buildContext: (input: {
    workspaceId: string;
    organizationId: string;
    projectId?: string;
    agentId?: string;
    actorId: string;
    referenceIds: string[];
    capabilityPermissions: string[];
    permissionActions: string[];
    genomeVersion?: string;
    toolVersions?: Record<string, string>;
    maxReferences?: number;
  }) => Promise<{
    contextPackage: ContextPackage;
    validation: ContextValidation;
    cache: ContextCache;
    rejectedReferences: Array<{ memoryReferenceId: string; reason: string }>;
    fromCache: boolean;
  }>;
  replayContext: (contextPackageId: string) => Promise<{ replay: ContextReplay; contextPackage: ContextPackage | null }>;
  listContextPackages: (workspaceId: string) => Promise<ContextPackage[]>;
  listHealth: (workspaceId: string) => Promise<ContextHealth[]>;
  listCache: (workspaceId: string) => Promise<ContextCache[]>;
  listValidations: (contextPackageId?: string) => Promise<ContextValidation[]>;
  listReplays: (contextPackageId?: string) => Promise<ContextReplay[]>;
};

function buildSections(references: MemoryReference[]): ContextSection[] {
  const grouped = new Map<string, MemoryReference[]>();
  for (const reference of references) {
    const key = reference.source.sourceType;
    const current = grouped.get(key) ?? [];
    current.push(reference);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceType, refs], index) => ({
      sectionId: createContextIds().contextSectionId,
      sourceType: sourceType as ContextSection["sourceType"],
      title: `${sourceType} Context`,
      order: index + 1,
      references: deterministicSortReferences(refs).map((entry) => ({
        memoryReferenceId: entry.memoryReferenceId,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        referenceVersion: entry.referenceVersion,
        authorityState: entry.authorityState,
        provenance: {
          sourceId: entry.source.sourceId,
          sourceVersion: entry.source.sourceVersion,
          artifactId: entry.referenceId,
          timestamp: entry.updatedAt,
          workspaceId: entry.workspaceId,
          projectId: entry.projectId,
          registryIdentity: entry.registryIdentity,
          validationState: entry.authorityState === "UNVERIFIED" ? "FAILED" : "PASSED",
        },
        metadata: entry.metadata,
      })),
    }));
}

function optimizeReferences(references: MemoryReference[], maxReferences: number): MemoryReference[] {
  const dedup = new Map<string, MemoryReference>();
  for (const ref of references) {
    const key = `${ref.referenceType}|${ref.referenceId}|${ref.referenceVersion}|${ref.source.sourceVersion}`;
    if (!dedup.has(key)) {
      dedup.set(key, ref);
    }
  }

  return deterministicSortReferences([...dedup.values()]).slice(0, maxReferences);
}

function createDependencies(references: MemoryReference[], genomeVersion: string, toolVersions: Record<string, string>): ContextDependency[] {
  const deps: ContextDependency[] = [];
  for (const reference of references) {
    deps.push({
      contextDependencyId: createContextIds().contextDependencyId,
      dependencyType: "MEMORY_REFERENCE",
      dependencyReferenceId: reference.memoryReferenceId,
      dependencyVersion: reference.referenceVersion,
    });
    deps.push({
      contextDependencyId: createContextIds().contextDependencyId,
      dependencyType: "SOURCE",
      dependencyReferenceId: reference.source.sourceId,
      dependencyVersion: reference.source.sourceVersion,
    });
  }

  deps.push({
    contextDependencyId: createContextIds().contextDependencyId,
    dependencyType: "GENOME_VERSION",
    dependencyReferenceId: "business-genome",
    dependencyVersion: genomeVersion,
  });

  for (const [toolKey, toolVersion] of Object.entries(toolVersions).sort((a, b) => a[0].localeCompare(b[0]))) {
    deps.push({
      contextDependencyId: createContextIds().contextDependencyId,
      dependencyType: "TOOL_VERSION",
      dependencyReferenceId: toolKey,
      dependencyVersion: toolVersion,
    });
  }

  deps.push({
    contextDependencyId: createContextIds().contextDependencyId,
    dependencyType: "RUNTIME_VERSION",
    dependencyReferenceId: "gea-context-runtime",
    dependencyVersion: currentRuntimeVersion(),
  });

  return deps;
}

function validatePackage(pkg: ContextPackage): ContextValidation {
  const issues: string[] = [];
  if (!pkg.workspaceId) issues.push("workspaceId is required.");
  if (!pkg.organizationId) issues.push("organizationId is required.");
  if (pkg.sections.length === 0) issues.push("At least one context section is required.");

  return {
    contextValidationId: createContextIds().contextValidationId,
    contextPackageId: pkg.contextPackageId,
    validationStatus: issues.length === 0 ? "PASSED" : "FAILED",
    issues,
    validatedAt: nowIso(),
  };
}

async function computeHealth(repository: MemoryRepository, workspaceId: string, organizationId: string): Promise<ContextHealth> {
  const packages = await repository.listContextPackages(workspaceId);
  const packageIds = new Set(packages.map((entry) => entry.contextPackageId));
  const validations = (await repository.listContextValidations())
    .filter((entry) => packageIds.has(entry.contextPackageId));
  const caches = await repository.listContextCaches(workspaceId);

  const validationFailures = validations.filter((entry) => entry.validationStatus === "FAILED").length;
  const cacheUtilization = packages.length === 0 ? 0 : Math.min(1, caches.length / packages.length);

  const latencies = packages.map((entry) => entry.assembly.buildLatencyMs);
  const assemblyLatencyMs = latencies.length === 0 ? 0 : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);

  const healthStatus: ContextHealth["healthStatus"] =
    validationFailures === 0 && cacheUtilization >= 0.5
      ? "HEALTHY"
      : validationFailures <= 2
        ? "DEGRADED"
        : "UNHEALTHY";

  return {
    contextHealthId: createContextIds().contextHealthId,
    workspaceId,
    organizationId,
    assemblyLatencyMs,
    cacheUtilization,
    validationFailures,
    authorizationFailures: 0,
    missingReferences: 0,
    staleReferences: 0,
    versionDrift: 0,
    healthStatus,
    computedAt: nowIso(),
  };
}

export function createContextBuilderService(input: {
  repository: MemoryRepository;
  registry: MemoryRegistryService;
  resolver: MemoryResolver;
}): ContextBuilderService {
  return {
    async buildContext(request) {
      const policy = {
        ...defaultContextPolicy(),
        maxReferences: request.maxReferences ?? defaultContextPolicy().maxReferences,
      };

      const resolved = await input.registry.resolveReferences(request.workspaceId, request.referenceIds, request.projectId);
      const authorization = input.resolver.resolveAuthorized({
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        references: resolved,
        capabilityPermissions: request.capabilityPermissions,
        permissionActions: request.permissionActions,
      });

      const optimized = optimizeReferences(authorization.authorized, policy.maxReferences);
      const sourceVersions = Object.fromEntries(
        optimized
          .map((entry) => [entry.source.sourceId, entry.source.sourceVersion] as const)
          .sort((a, b) => a[0].localeCompare(b[0])),
      );

      const cacheKey = createContextCacheKey({
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        referenceKeys: optimized.map((entry) => `${entry.memoryReferenceId}:${entry.referenceVersion}`),
        sourceVersions,
        policyVersion: policy.policyVersion,
      });

      const cached = await input.repository.getContextCache(request.workspaceId, cacheKey);
      if (cached) {
        const cachedPackage = await input.repository.getContextPackage(cached.contextPackageId);
        if (cachedPackage) {
          const updatedCache: ContextCache = {
            ...cached,
            hitCount: cached.hitCount + 1,
            lastHitAt: nowIso(),
            updatedAt: nowIso(),
          };
          await input.repository.saveContextCache(updatedCache);

          const validation = (await input.repository.listContextValidations(cachedPackage.contextPackageId))[0]
            ?? validatePackage(cachedPackage);

          return {
            contextPackage: cachedPackage,
            validation,
            cache: updatedCache,
            rejectedReferences: authorization.rejected,
            fromCache: true,
          };
        }
      }

      const started = Date.now();
      const sections = buildSections(optimized);
      const dependencies = createDependencies(optimized, request.genomeVersion ?? "genome/v1", request.toolVersions ?? {});
      const assemblyVersion = currentAssemblyVersion();
      const timeline: ContextTimeline[] = [
        { sequence: 1, at: nowIso(), eventType: "ASSEMBLY_STARTED", note: "Context assembly started." },
        { sequence: 2, at: nowIso(), eventType: "AUTHORIZATION_FILTERED", note: "Authorization filtering completed.", metadata: { rejected: authorization.rejected.length } },
        { sequence: 3, at: nowIso(), eventType: "OPTIMIZED", note: "Deterministic optimization applied.", metadata: { optimized: optimized.length } },
      ];

      const packageChecksum = stableChecksum({
        sections,
        dependencies,
        assemblyVersion,
        runtimeVersion: currentRuntimeVersion(),
        sourceVersions,
        policyVersion: policy.policyVersion,
      });

      const pkg: ContextPackage = {
        contextPackageId: createContextIds().contextPackageId,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        agentId: request.agentId,
        lifecycleState: "ASSEMBLED",
        contextVersion: "gea-context/v1",
        sections,
        dependencies,
        assembly: {
          assemblyVersion,
          runtimeVersion: currentRuntimeVersion(),
          genomeVersion: request.genomeVersion ?? "genome/v1",
          toolVersions: request.toolVersions ?? {},
          sourceVersions,
          builtAt: nowIso(),
          builtBy: request.actorId,
          deterministic: true,
          buildLatencyMs: Date.now() - started,
        },
        policy,
        timeline,
        packageChecksum,
        cacheKey,
        deterministic: true,
        createdAt: nowIso(),
      };

      const validation = validatePackage(pkg);
      pkg.lifecycleState = validation.validationStatus === "PASSED" ? "VALIDATED" : "ASSEMBLED";
      pkg.timeline = [
        ...pkg.timeline,
        {
          sequence: pkg.timeline.length + 1,
          at: nowIso(),
          eventType: "VALIDATED",
          note: validation.validationStatus === "PASSED" ? "Context validation passed." : "Context validation failed.",
          metadata: { issues: validation.issues.length },
        },
      ];

      const saved = await input.repository.saveContextPackage(pkg);
      await input.repository.saveContextValidation(validation);

      const cache: ContextCache = {
        contextCacheId: createContextIds().contextCacheId,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        cacheKey,
        contextPackageId: saved.contextPackageId,
        sourceVersionFingerprint: createSourceVersionFingerprint(sourceVersions),
        cacheStatus: "ACTIVE",
        hitCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await input.repository.saveContextCache(cache);

      const health = await computeHealth(input.repository, request.workspaceId, request.organizationId);
      await input.repository.saveContextHealth(health);

      return {
        contextPackage: saved,
        validation,
        cache,
        rejectedReferences: authorization.rejected,
        fromCache: false,
      };
    },

    async replayContext(contextPackageId) {
      const pkg = await input.repository.getContextPackage(contextPackageId);
      if (!pkg) {
        return {
          replay: {
            contextReplayId: createContextIds().contextReplayId,
            contextPackageId,
            replayChecksum: stableChecksum({ missing: contextPackageId }),
            deterministicPossible: false,
            reason: "Context package not found.",
            createdAt: nowIso(),
          },
          contextPackage: null,
        };
      }

      const reconstructed = stableChecksum({
        sections: pkg.sections,
        dependencies: pkg.dependencies,
        assemblyVersion: pkg.assembly.assemblyVersion,
        runtimeVersion: pkg.assembly.runtimeVersion,
        sourceVersions: pkg.assembly.sourceVersions,
        policyVersion: pkg.policy.policyVersion,
      });

      const deterministicPossible = true;
      const deterministicMatch = reconstructed === pkg.packageChecksum;

      const replay: ContextReplay = {
        contextReplayId: createContextIds().contextReplayId,
        contextPackageId,
        replayChecksum: reconstructed,
        deterministicPossible,
        deterministicMatch,
        reason: deterministicMatch ? undefined : "Source versions changed since original package assembly.",
        createdAt: nowIso(),
      };

      await input.repository.saveContextReplay(replay);
      return { replay, contextPackage: pkg };
    },

    async listContextPackages(workspaceId) {
      return input.repository.listContextPackages(workspaceId);
    },

    async listHealth(workspaceId) {
      return input.repository.listContextHealth(workspaceId);
    },

    async listCache(workspaceId) {
      return input.repository.listContextCaches(workspaceId);
    },

    async listValidations(contextPackageId) {
      return input.repository.listContextValidations(contextPackageId);
    },

    async listReplays(contextPackageId) {
      return input.repository.listContextReplays(contextPackageId);
    },
  };
}
