import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  ContextCache,
  ContextHealth,
  ContextPackage,
  ContextReplay,
  ContextValidation,
  MemoryCollection,
  MemoryReference,
  MemorySnapshot,
  MemorySource,
  MemoryVersion,
} from "./memory-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type MemoryRepository = {
  saveReference: (reference: MemoryReference) => Promise<MemoryReference>;
  getReference: (memoryReferenceId: string) => Promise<MemoryReference | null>;
  listReferences: (workspaceId: string, projectId?: string) => Promise<MemoryReference[]>;

  saveSource: (source: MemorySource) => Promise<MemorySource>;
  saveVersion: (version: MemoryVersion) => Promise<MemoryVersion>;

  saveCollection: (collection: MemoryCollection) => Promise<MemoryCollection>;
  listCollections: (workspaceId: string) => Promise<MemoryCollection[]>;

  saveSnapshot: (snapshot: MemorySnapshot) => Promise<MemorySnapshot>;
  listSnapshots: (workspaceId: string) => Promise<MemorySnapshot[]>;

  saveContextPackage: (pkg: ContextPackage) => Promise<ContextPackage>;
  getContextPackage: (contextPackageId: string) => Promise<ContextPackage | null>;
  listContextPackages: (workspaceId: string) => Promise<ContextPackage[]>;

  saveContextValidation: (validation: ContextValidation) => Promise<ContextValidation>;
  listContextValidations: (contextPackageId?: string) => Promise<ContextValidation[]>;

  saveContextReplay: (replay: ContextReplay) => Promise<ContextReplay>;
  listContextReplays: (contextPackageId?: string) => Promise<ContextReplay[]>;

  saveContextCache: (cache: ContextCache) => Promise<ContextCache>;
  getContextCache: (workspaceId: string, cacheKey: string) => Promise<ContextCache | null>;
  listContextCaches: (workspaceId: string) => Promise<ContextCache[]>;

  saveContextHealth: (health: ContextHealth) => Promise<ContextHealth>;
  listContextHealth: (workspaceId: string) => Promise<ContextHealth[]>;
};

export function createInMemoryMemoryRepository(): MemoryRepository {
  const references = new Map<string, MemoryReference>();
  const sources = new Map<string, MemorySource>();
  const versions = new Map<string, MemoryVersion>();
  const collections = new Map<string, MemoryCollection>();
  const snapshots = new Map<string, MemorySnapshot>();
  const packages = new Map<string, ContextPackage>();
  const validations = new Map<string, ContextValidation>();
  const replays = new Map<string, ContextReplay>();
  const caches = new Map<string, ContextCache>();
  const health = new Map<string, ContextHealth>();

  return {
    async saveReference(reference) {
      references.set(reference.memoryReferenceId, reference);
      sources.set(reference.source.memorySourceId, reference.source);
      versions.set(reference.memoryVersion.memoryVersionId, reference.memoryVersion);
      return reference;
    },
    async getReference(memoryReferenceId) {
      return references.get(memoryReferenceId) ?? null;
    },
    async listReferences(workspaceId, projectId) {
      return [...references.values()]
        .filter((entry) => entry.workspaceId === workspaceId && (!projectId || entry.projectId === projectId))
        .sort((a, b) => a.registryIdentity.localeCompare(b.registryIdentity));
    },

    async saveSource(source) {
      sources.set(source.memorySourceId, source);
      return source;
    },
    async saveVersion(version) {
      versions.set(version.memoryVersionId, version);
      return version;
    },

    async saveCollection(collection) {
      collections.set(collection.memoryCollectionId, collection);
      return collection;
    },
    async listCollections(workspaceId) {
      return [...collections.values()].filter((entry) => entry.workspaceId === workspaceId);
    },

    async saveSnapshot(snapshot) {
      snapshots.set(snapshot.memorySnapshotId, snapshot);
      return snapshot;
    },
    async listSnapshots(workspaceId) {
      return [...snapshots.values()].filter((entry) => entry.workspaceId === workspaceId);
    },

    async saveContextPackage(pkg) {
      packages.set(pkg.contextPackageId, pkg);
      return pkg;
    },
    async getContextPackage(contextPackageId) {
      return packages.get(contextPackageId) ?? null;
    },
    async listContextPackages(workspaceId) {
      return [...packages.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async saveContextValidation(validation) {
      validations.set(validation.contextValidationId, validation);
      return validation;
    },
    async listContextValidations(contextPackageId) {
      const list = [...validations.values()];
      return contextPackageId ? list.filter((entry) => entry.contextPackageId === contextPackageId) : list;
    },

    async saveContextReplay(replay) {
      replays.set(replay.contextReplayId, replay);
      return replay;
    },
    async listContextReplays(contextPackageId) {
      const list = [...replays.values()];
      return contextPackageId ? list.filter((entry) => entry.contextPackageId === contextPackageId) : list;
    },

    async saveContextCache(entry) {
      caches.set(entry.contextCacheId, entry);
      return entry;
    },
    async getContextCache(workspaceId, cacheKey) {
      return [...caches.values()].find((entry) => entry.workspaceId === workspaceId && entry.cacheKey === cacheKey) ?? null;
    },
    async listContextCaches(workspaceId) {
      return [...caches.values()].filter((entry) => entry.workspaceId === workspaceId);
    },

    async saveContextHealth(entry) {
      health.set(entry.contextHealthId, entry);
      return entry;
    },
    async listContextHealth(workspaceId) {
      return [...health.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.computedAt.localeCompare(a.computedAt));
    },
  };
}

function parseReference(row: {
  memoryReferenceId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string | null;
  registryIdentity: string;
  referenceType: string;
  referenceId: string;
  referenceVersion: string;
  source: unknown;
  memoryVersion: unknown;
  capabilityKey: string | null;
  permissionAction: string | null;
  authorityState: string;
  immutable: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MemoryReference {
  return {
    memoryReferenceId: row.memoryReferenceId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId ?? undefined,
    registryIdentity: row.registryIdentity,
    referenceType: row.referenceType as MemoryReference["referenceType"],
    referenceId: row.referenceId,
    referenceVersion: row.referenceVersion,
    source: row.source as MemorySource,
    memoryVersion: row.memoryVersion as MemoryVersion,
    capabilityKey: row.capabilityKey ?? undefined,
    permissionAction: row.permissionAction ?? undefined,
    authorityState: row.authorityState as MemoryReference["authorityState"],
    immutable: row.immutable,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseContextPackage(row: {
  contextPackageId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string | null;
  agentId: string | null;
  lifecycleState: string;
  contextVersion: string;
  sections: unknown;
  dependencies: unknown;
  assembly: unknown;
  policy: unknown;
  timeline: unknown;
  packageChecksum: string;
  cacheKey: string;
  deterministic: boolean;
  createdAt: Date;
}): ContextPackage {
  return {
    contextPackageId: row.contextPackageId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    projectId: row.projectId ?? undefined,
    agentId: row.agentId ?? undefined,
    lifecycleState: row.lifecycleState as ContextPackage["lifecycleState"],
    contextVersion: row.contextVersion,
    sections: row.sections as ContextPackage["sections"],
    dependencies: row.dependencies as ContextPackage["dependencies"],
    assembly: row.assembly as ContextPackage["assembly"],
    policy: row.policy as ContextPackage["policy"],
    timeline: row.timeline as ContextPackage["timeline"],
    packageChecksum: row.packageChecksum,
    cacheKey: row.cacheKey,
    deterministic: row.deterministic,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createPrismaMemoryRepository(prismaClient?: PrismaClient): MemoryRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async saveReference(reference) {
      await prisma.geaMemoryReference.upsert({
        where: { memoryReferenceId: reference.memoryReferenceId },
        create: {
          memoryReferenceId: reference.memoryReferenceId,
          workspaceId: reference.workspaceId,
          organizationId: reference.organizationId,
          projectId: reference.projectId ?? null,
          registryIdentity: reference.registryIdentity,
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
          referenceVersion: reference.referenceVersion,
          source: toJson(reference.source),
          memoryVersion: toJson(reference.memoryVersion),
          capabilityKey: reference.capabilityKey ?? null,
          permissionAction: reference.permissionAction ?? null,
          authorityState: reference.authorityState,
          immutable: reference.immutable,
          metadata: toJson(reference.metadata ?? {}),
        },
        update: {
          referenceVersion: reference.referenceVersion,
          source: toJson(reference.source),
          memoryVersion: toJson(reference.memoryVersion),
          capabilityKey: reference.capabilityKey ?? null,
          permissionAction: reference.permissionAction ?? null,
          authorityState: reference.authorityState,
          immutable: reference.immutable,
          metadata: toJson(reference.metadata ?? {}),
        },
      });
      return reference;
    },

    async getReference(memoryReferenceId) {
      const row = await prisma.geaMemoryReference.findUnique({ where: { memoryReferenceId } });
      return row ? parseReference(row) : null;
    },

    async listReferences(workspaceId, projectId) {
      const rows = await prisma.geaMemoryReference.findMany({
        where: { workspaceId, ...(projectId ? { projectId } : {}) },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(parseReference);
    },

    async saveSource(source) {
      await prisma.geaMemorySource.upsert({
        where: { memorySourceId: source.memorySourceId },
        create: {
          memorySourceId: source.memorySourceId,
          workspaceId: source.workspaceId,
          organizationId: source.organizationId,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          authoritative: source.authoritative,
          metadata: toJson(source.metadata ?? {}),
        },
        update: {
          sourceVersion: source.sourceVersion,
          authoritative: source.authoritative,
          metadata: toJson(source.metadata ?? {}),
        },
      });
      return source;
    },

    async saveVersion(version) {
      await prisma.geaMemoryVersion.upsert({
        where: { memoryVersionId: version.memoryVersionId },
        create: {
          memoryVersionId: version.memoryVersionId,
          memoryReferenceId: version.memoryReferenceId,
          versionTag: version.versionTag,
          checksum: version.checksum,
          createdAt: new Date(version.createdAt),
        },
        update: {
          versionTag: version.versionTag,
          checksum: version.checksum,
        },
      });
      return version;
    },

    async saveCollection(collection) {
      await prisma.geaMemoryCollection.upsert({
        where: { memoryCollectionId: collection.memoryCollectionId },
        create: {
          memoryCollectionId: collection.memoryCollectionId,
          workspaceId: collection.workspaceId,
          organizationId: collection.organizationId,
          name: collection.name,
          description: collection.description ?? null,
          lifecycleState: collection.lifecycleState,
          memoryReferenceIds: toJson(collection.memoryReferenceIds),
        },
        update: {
          name: collection.name,
          description: collection.description ?? null,
          lifecycleState: collection.lifecycleState,
          memoryReferenceIds: toJson(collection.memoryReferenceIds),
        },
      });
      return collection;
    },

    async listCollections(workspaceId) {
      const rows = await prisma.geaMemoryCollection.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        memoryCollectionId: row.memoryCollectionId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        name: row.name,
        description: row.description ?? undefined,
        lifecycleState: row.lifecycleState as MemoryCollection["lifecycleState"],
        memoryReferenceIds: row.memoryReferenceIds as string[],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveSnapshot(snapshot) {
      await prisma.geaMemorySnapshot.upsert({
        where: { memorySnapshotId: snapshot.memorySnapshotId },
        create: {
          memorySnapshotId: snapshot.memorySnapshotId,
          workspaceId: snapshot.workspaceId,
          organizationId: snapshot.organizationId,
          projectId: snapshot.projectId ?? null,
          memoryCollectionId: snapshot.memoryCollectionId ?? null,
          memoryReferenceIds: toJson(snapshot.memoryReferenceIds),
          snapshotChecksum: snapshot.snapshotChecksum,
          createdAt: new Date(snapshot.createdAt),
        },
        update: {
          memoryReferenceIds: toJson(snapshot.memoryReferenceIds),
          snapshotChecksum: snapshot.snapshotChecksum,
        },
      });
      return snapshot;
    },

    async listSnapshots(workspaceId) {
      const rows = await prisma.geaMemorySnapshot.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        memorySnapshotId: row.memorySnapshotId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        memoryCollectionId: row.memoryCollectionId ?? undefined,
        memoryReferenceIds: row.memoryReferenceIds as string[],
        snapshotChecksum: row.snapshotChecksum,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveContextPackage(pkg) {
      await prisma.geaContextPackage.upsert({
        where: { contextPackageId: pkg.contextPackageId },
        create: {
          contextPackageId: pkg.contextPackageId,
          workspaceId: pkg.workspaceId,
          organizationId: pkg.organizationId,
          projectId: pkg.projectId ?? null,
          agentId: pkg.agentId ?? null,
          lifecycleState: pkg.lifecycleState,
          contextVersion: pkg.contextVersion,
          sections: toJson(pkg.sections),
          dependencies: toJson(pkg.dependencies),
          assembly: toJson(pkg.assembly),
          policy: toJson(pkg.policy),
          timeline: toJson(pkg.timeline),
          packageChecksum: pkg.packageChecksum,
          cacheKey: pkg.cacheKey,
          deterministic: pkg.deterministic,
          createdAt: new Date(pkg.createdAt),
        },
        update: {
          lifecycleState: pkg.lifecycleState,
          sections: toJson(pkg.sections),
          dependencies: toJson(pkg.dependencies),
          assembly: toJson(pkg.assembly),
          policy: toJson(pkg.policy),
          timeline: toJson(pkg.timeline),
          packageChecksum: pkg.packageChecksum,
          cacheKey: pkg.cacheKey,
          deterministic: pkg.deterministic,
        },
      });
      return pkg;
    },

    async getContextPackage(contextPackageId) {
      const row = await prisma.geaContextPackage.findUnique({ where: { contextPackageId } });
      return row ? parseContextPackage(row) : null;
    },

    async listContextPackages(workspaceId) {
      const rows = await prisma.geaContextPackage.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map(parseContextPackage);
    },

    async saveContextValidation(validation) {
      await prisma.geaContextValidation.upsert({
        where: { contextValidationId: validation.contextValidationId },
        create: {
          contextValidationId: validation.contextValidationId,
          contextPackageId: validation.contextPackageId,
          validationStatus: validation.validationStatus,
          issues: toJson(validation.issues),
          validatedAt: new Date(validation.validatedAt),
        },
        update: {
          validationStatus: validation.validationStatus,
          issues: toJson(validation.issues),
          validatedAt: new Date(validation.validatedAt),
        },
      });
      return validation;
    },

    async listContextValidations(contextPackageId) {
      const rows = await prisma.geaContextValidation.findMany({
        where: contextPackageId ? { contextPackageId } : undefined,
        orderBy: { validatedAt: "desc" },
      });
      return rows.map((row) => ({
        contextValidationId: row.contextValidationId,
        contextPackageId: row.contextPackageId,
        validationStatus: row.validationStatus as ContextValidation["validationStatus"],
        issues: row.issues as string[],
        validatedAt: row.validatedAt.toISOString(),
      }));
    },

    async saveContextReplay(replay) {
      await prisma.geaContextReplay.upsert({
        where: { contextReplayId: replay.contextReplayId },
        create: {
          contextReplayId: replay.contextReplayId,
          contextPackageId: replay.contextPackageId,
          replayChecksum: replay.replayChecksum,
          deterministicPossible: replay.deterministicPossible,
          deterministicMatch: replay.deterministicMatch ?? null,
          reason: replay.reason ?? null,
          createdAt: new Date(replay.createdAt),
        },
        update: {
          replayChecksum: replay.replayChecksum,
          deterministicPossible: replay.deterministicPossible,
          deterministicMatch: replay.deterministicMatch ?? null,
          reason: replay.reason ?? null,
        },
      });
      return replay;
    },

    async listContextReplays(contextPackageId) {
      const rows = await prisma.geaContextReplay.findMany({
        where: contextPackageId ? { contextPackageId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) => ({
        contextReplayId: row.contextReplayId,
        contextPackageId: row.contextPackageId,
        replayChecksum: row.replayChecksum,
        deterministicPossible: row.deterministicPossible,
        deterministicMatch: row.deterministicMatch ?? undefined,
        reason: row.reason ?? undefined,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveContextCache(cache) {
      await prisma.geaContextCache.upsert({
        where: { contextCacheId: cache.contextCacheId },
        create: {
          contextCacheId: cache.contextCacheId,
          workspaceId: cache.workspaceId,
          organizationId: cache.organizationId,
          cacheKey: cache.cacheKey,
          contextPackageId: cache.contextPackageId,
          sourceVersionFingerprint: cache.sourceVersionFingerprint,
          cacheStatus: cache.cacheStatus,
          hitCount: cache.hitCount,
          lastHitAt: cache.lastHitAt ? new Date(cache.lastHitAt) : null,
          createdAt: new Date(cache.createdAt),
          updatedAt: new Date(cache.updatedAt),
        },
        update: {
          contextPackageId: cache.contextPackageId,
          sourceVersionFingerprint: cache.sourceVersionFingerprint,
          cacheStatus: cache.cacheStatus,
          hitCount: cache.hitCount,
          lastHitAt: cache.lastHitAt ? new Date(cache.lastHitAt) : null,
          updatedAt: new Date(cache.updatedAt),
        },
      });
      return cache;
    },

    async getContextCache(workspaceId, cacheKey) {
      const row = await prisma.geaContextCache.findFirst({ where: { workspaceId, cacheKey, cacheStatus: "ACTIVE" } });
      if (!row) return null;
      return {
        contextCacheId: row.contextCacheId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        cacheKey: row.cacheKey,
        contextPackageId: row.contextPackageId,
        sourceVersionFingerprint: row.sourceVersionFingerprint,
        cacheStatus: row.cacheStatus as ContextCache["cacheStatus"],
        hitCount: row.hitCount,
        lastHitAt: row.lastHitAt?.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    async listContextCaches(workspaceId) {
      const rows = await prisma.geaContextCache.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        contextCacheId: row.contextCacheId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        cacheKey: row.cacheKey,
        contextPackageId: row.contextPackageId,
        sourceVersionFingerprint: row.sourceVersionFingerprint,
        cacheStatus: row.cacheStatus as ContextCache["cacheStatus"],
        hitCount: row.hitCount,
        lastHitAt: row.lastHitAt?.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveContextHealth(entry) {
      await prisma.geaContextHealth.upsert({
        where: { contextHealthId: entry.contextHealthId },
        create: {
          contextHealthId: entry.contextHealthId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          assemblyLatencyMs: entry.assemblyLatencyMs,
          cacheUtilization: entry.cacheUtilization,
          validationFailures: entry.validationFailures,
          authorizationFailures: entry.authorizationFailures,
          missingReferences: entry.missingReferences,
          staleReferences: entry.staleReferences,
          versionDrift: entry.versionDrift,
          healthStatus: entry.healthStatus,
          computedAt: new Date(entry.computedAt),
        },
        update: {
          assemblyLatencyMs: entry.assemblyLatencyMs,
          cacheUtilization: entry.cacheUtilization,
          validationFailures: entry.validationFailures,
          authorizationFailures: entry.authorizationFailures,
          missingReferences: entry.missingReferences,
          staleReferences: entry.staleReferences,
          versionDrift: entry.versionDrift,
          healthStatus: entry.healthStatus,
          computedAt: new Date(entry.computedAt),
        },
      });
      return entry;
    },

    async listContextHealth(workspaceId) {
      const rows = await prisma.geaContextHealth.findMany({ where: { workspaceId }, orderBy: { computedAt: "desc" } });
      return rows.map((row) => ({
        contextHealthId: row.contextHealthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        assemblyLatencyMs: row.assemblyLatencyMs,
        cacheUtilization: row.cacheUtilization,
        validationFailures: row.validationFailures,
        authorizationFailures: row.authorizationFailures,
        missingReferences: row.missingReferences,
        staleReferences: row.staleReferences,
        versionDrift: row.versionDrift,
        healthStatus: row.healthStatus as ContextHealth["healthStatus"],
        computedAt: row.computedAt.toISOString(),
      }));
    },
  };
}
