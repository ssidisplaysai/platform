import { nowIso, stableChecksum } from "./agent-models";
import {
  createContextIds,
  deterministicSortReferences,
  type MemoryCollection,
  type MemoryReference,
  type MemorySnapshot,
  type MemorySource,
  type MemoryVersion,
} from "./memory-models";
import type { MemoryRepository } from "./memory-repository";

export type MemoryRegistryService = {
  registerReference: (input: {
    workspaceId: string;
    organizationId: string;
    projectId?: string;
    registryIdentity: string;
    referenceType: MemoryReference["referenceType"];
    referenceId: string;
    referenceVersion: string;
    source: Omit<MemorySource, "memorySourceId" | "createdAt" | "updatedAt" | "workspaceId" | "organizationId">;
    capabilityKey?: string;
    permissionAction?: string;
    authorityState: MemoryReference["authorityState"];
    immutable: boolean;
    metadata?: Record<string, unknown>;
  }) => Promise<MemoryReference>;
  listReferences: (workspaceId: string, projectId?: string) => Promise<MemoryReference[]>;
  getReference: (memoryReferenceId: string) => Promise<MemoryReference | null>;
  resolveReferences: (workspaceId: string, referenceIds: string[], projectId?: string) => Promise<MemoryReference[]>;
  createCollection: (input: {
    workspaceId: string;
    organizationId: string;
    name: string;
    description?: string;
    memoryReferenceIds: string[];
  }) => Promise<MemoryCollection>;
  createSnapshot: (input: {
    workspaceId: string;
    organizationId: string;
    projectId?: string;
    memoryCollectionId?: string;
    memoryReferenceIds: string[];
  }) => Promise<MemorySnapshot>;
};

export type MemoryResolver = {
  resolveAuthorized: (input: {
    workspaceId: string;
    organizationId: string;
    projectId?: string;
    references: MemoryReference[];
    capabilityPermissions: string[];
    permissionActions: string[];
  }) => { authorized: MemoryReference[]; rejected: Array<{ memoryReferenceId: string; reason: string }> };
};

export type MemoryCatalog = {
  search: (workspaceId: string, query?: string) => Promise<MemoryReference[]>;
};

export function createMemoryRegistryService(repository: MemoryRepository): MemoryRegistryService {
  return {
    async registerReference(input) {
      const ids = createContextIds();
      const now = nowIso();

      const source: MemorySource = {
        memorySourceId: ids.memorySourceId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        sourceType: input.source.sourceType,
        sourceId: input.source.sourceId,
        sourceVersion: input.source.sourceVersion,
        authoritative: input.source.authoritative,
        metadata: input.source.metadata,
        createdAt: now,
        updatedAt: now,
      };

      const version: MemoryVersion = {
        memoryVersionId: ids.memoryVersionId,
        memoryReferenceId: ids.memoryReferenceId,
        versionTag: input.referenceVersion,
        checksum: stableChecksum({
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceVersion: input.referenceVersion,
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
        }),
        createdAt: now,
      };

      const reference: MemoryReference = {
        memoryReferenceId: ids.memoryReferenceId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        registryIdentity: input.registryIdentity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        referenceVersion: input.referenceVersion,
        source,
        memoryVersion: version,
        capabilityKey: input.capabilityKey,
        permissionAction: input.permissionAction,
        authorityState: input.authorityState,
        immutable: input.immutable,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await repository.saveSource(source);
      await repository.saveVersion(version);
      return repository.saveReference(reference);
    },

    async listReferences(workspaceId, projectId) {
      return repository.listReferences(workspaceId, projectId);
    },

    async getReference(memoryReferenceId) {
      return repository.getReference(memoryReferenceId);
    },

    async resolveReferences(workspaceId, referenceIds, projectId) {
      const available = await repository.listReferences(workspaceId, projectId);
      const byId = new Map(available.map((entry) => [entry.memoryReferenceId, entry]));
      return referenceIds
        .map((id) => byId.get(id) ?? null)
        .filter((entry): entry is MemoryReference => Boolean(entry));
    },

    async createCollection(input) {
      const now = nowIso();
      const collection: MemoryCollection = {
        memoryCollectionId: createContextIds().memoryCollectionId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        lifecycleState: "ACTIVE",
        memoryReferenceIds: [...input.memoryReferenceIds],
        createdAt: now,
        updatedAt: now,
      };
      return repository.saveCollection(collection);
    },

    async createSnapshot(input) {
      const resolved = await this.resolveReferences(input.workspaceId, input.memoryReferenceIds, input.projectId);
      const ordered = deterministicSortReferences(resolved);
      const snapshot: MemorySnapshot = {
        memorySnapshotId: createContextIds().memorySnapshotId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        memoryCollectionId: input.memoryCollectionId,
        memoryReferenceIds: ordered.map((entry) => entry.memoryReferenceId),
        snapshotChecksum: stableChecksum(ordered.map((entry) => ({ id: entry.memoryReferenceId, v: entry.referenceVersion }))),
        createdAt: nowIso(),
      };
      return repository.saveSnapshot(snapshot);
    },
  };
}

export function createMemoryResolver(): MemoryResolver {
  return {
    resolveAuthorized(input) {
      const authorized: MemoryReference[] = [];
      const rejected: Array<{ memoryReferenceId: string; reason: string }> = [];

      for (const reference of input.references) {
        if (reference.workspaceId !== input.workspaceId) {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Workspace isolation denied." });
          continue;
        }

        if (reference.organizationId !== input.organizationId) {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Organization isolation denied." });
          continue;
        }

        if (reference.projectId && input.projectId && reference.projectId !== input.projectId) {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Project isolation denied." });
          continue;
        }

        if (reference.capabilityKey && !input.capabilityPermissions.includes(`capability:${reference.capabilityKey}`)) {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Capability permission denied." });
          continue;
        }

        if (reference.permissionAction && !input.permissionActions.includes(reference.permissionAction)) {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Object permission denied." });
          continue;
        }

        if (!reference.source.authoritative || reference.authorityState === "UNVERIFIED") {
          rejected.push({ memoryReferenceId: reference.memoryReferenceId, reason: "Authoritative source validation failed." });
          continue;
        }

        authorized.push(reference);
      }

      return { authorized, rejected };
    },
  };
}

export function createMemoryCatalog(repository: MemoryRepository): MemoryCatalog {
  return {
    async search(workspaceId, query) {
      const references = await repository.listReferences(workspaceId);
      const q = query?.trim().toLowerCase();
      if (!q) return references;

      return references.filter((entry) => {
        return entry.registryIdentity.toLowerCase().includes(q)
          || entry.referenceId.toLowerCase().includes(q)
          || entry.referenceType.toLowerCase().includes(q)
          || entry.source.sourceType.toLowerCase().includes(q);
      });
    },
  };
}
