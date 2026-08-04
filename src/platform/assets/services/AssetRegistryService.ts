import { randomUUID } from "node:crypto";
import {
  AssetError,
  type AssetActorContext,
  type AssetCollection,
  type AssetId,
  type AssetMetadata,
  type AssetProviderType,
  type AssetRecord,
  type AssetRelationship,
  type AssetType,
  type TenantId,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { AssetAuditService } from "./AssetAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTags(tags: string[] | undefined): string[] {
  const normalized = (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return [...new Set(normalized)];
}

export class AssetRegistryService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: AssetAuditService,
  ) {}

  listAssets(tenantId?: TenantId): AssetRecord[] {
    return this.persistence.listAssets(tenantId);
  }

  getAsset(assetId: AssetId): AssetRecord | undefined {
    return this.persistence.getAsset(assetId);
  }

  listCollections(tenantId?: TenantId): AssetCollection[] {
    return this.persistence.listCollections(tenantId);
  }

  listRelationships(tenantId?: TenantId): AssetRelationship[] {
    return this.persistence.listRelationships(tenantId);
  }

  async registerAsset(input: {
    tenantId: TenantId;
    type: AssetType;
    displayName: string;
    actor: AssetActorContext;
    provider: { providerId: string; providerType: AssetProviderType; bucket?: string; region?: string };
    initialVersion: {
      storageKey: string;
      sizeBytes: number;
      mimeType: string;
      checksumAlgorithm: "SHA256" | "SHA512";
      checksumDigest: string;
      metadata?: AssetMetadata;
    };
    metadata?: AssetMetadata;
    tags?: string[];
    retention?: { retainUntil?: string; legalHold?: boolean; policyId?: string };
  }): Promise<AssetRecord> {
    if (!input.tenantId || !input.displayName || !input.provider.providerId || !input.initialVersion.storageKey || !input.initialVersion.checksumDigest) {
      throw new AssetError("ASSET_INVALID", "missing required asset registration fields", false, true, "HIGH");
    }

    const at = nowIso();
    const versionId = `asset_version_${randomUUID()}`;
    const assetId = `asset_${randomUUID()}`;
    const asset: AssetRecord = {
      assetId,
      tenantId: input.tenantId,
      type: input.type,
      displayName: input.displayName.trim(),
      provider: structuredClone(input.provider),
      metadata: structuredClone(input.metadata ?? {}),
      tags: normalizeTags(input.tags),
      checksums: [{ algorithm: input.initialVersion.checksumAlgorithm, digest: input.initialVersion.checksumDigest, verifiedAt: at }],
      currentVersionId: versionId,
      versions: [{
        versionId,
        sequence: 1,
        storageKey: input.initialVersion.storageKey,
        sizeBytes: input.initialVersion.sizeBytes,
        mimeType: input.initialVersion.mimeType,
        checksum: {
          algorithm: input.initialVersion.checksumAlgorithm,
          digest: input.initialVersion.checksumDigest,
          verifiedAt: at,
        },
        createdAt: at,
        createdBy: input.actor.actorId,
        metadata: structuredClone(input.initialVersion.metadata ?? {}),
      }],
      relationships: [],
      collections: [],
      retention: {
        retainUntil: input.retention?.retainUntil,
        legalHold: input.retention?.legalHold ?? false,
        policyId: input.retention?.policyId,
      },
      lifecycle: { status: "ACTIVE" },
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      if (state.assets.some((item) => item.assetId === asset.assetId)) {
        throw new AssetError("ASSET_DUPLICATE", `duplicate asset id: ${asset.assetId}`, false, true, "HIGH");
      }
      state.assets.push(asset);
    });

    await this.audit.append({
      eventType: "ASSET_REGISTERED",
      tenantId: asset.tenantId,
      assetId: asset.assetId,
      actor: input.actor,
      message: `asset ${asset.assetId} registered`,
      details: { type: asset.type, provider: asset.provider.providerType },
    });

    return this.requireAsset(asset.assetId);
  }

  async addVersion(input: {
    tenantId: TenantId;
    assetId: AssetId;
    actor: AssetActorContext;
    storageKey: string;
    sizeBytes: number;
    mimeType: string;
    checksumAlgorithm: "SHA256" | "SHA512";
    checksumDigest: string;
    metadata?: AssetMetadata;
  }): Promise<AssetRecord> {
    const at = nowIso();
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      const versionId = `asset_version_${randomUUID()}`;
      const sequence = asset.versions.length + 1;
      asset.versions.push({
        versionId,
        sequence,
        storageKey: input.storageKey,
        sizeBytes: input.sizeBytes,
        mimeType: input.mimeType,
        checksum: {
          algorithm: input.checksumAlgorithm,
          digest: input.checksumDigest,
          verifiedAt: at,
        },
        createdAt: at,
        createdBy: input.actor.actorId,
        metadata: structuredClone(input.metadata ?? {}),
      });
      asset.currentVersionId = versionId;
      asset.checksums.push({ algorithm: input.checksumAlgorithm, digest: input.checksumDigest, verifiedAt: at });
      asset.updatedAt = at;
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_VERSION_ADDED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `version appended for ${input.assetId}`,
      details: { storageKey: input.storageKey },
    });

    return this.requireAsset(input.assetId);
  }

  async verifyIntegrity(input: {
    tenantId: TenantId;
    assetId: AssetId;
    versionId?: string;
    expectedDigest: string;
    actor: AssetActorContext;
  }): Promise<{ valid: boolean; versionId: string; expectedDigest: string; actualDigest: string }> {
    const asset = this.requireAsset(input.assetId);
    if (asset.tenantId !== input.tenantId) {
      throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
    }

    const version = asset.versions.find((item) => item.versionId === (input.versionId ?? asset.currentVersionId));
    if (!version) {
      throw new AssetError("VERSION_INVALID", `version not found for ${input.assetId}`, false, true, "MEDIUM");
    }

    const actualDigest = version.checksum.digest;
    const valid = actualDigest === input.expectedDigest;

    await this.persistence.incrementChecksumVerifications();
    if (!valid) {
      await this.persistence.incrementIntegrityFailures();
    }

    await this.audit.append({
      eventType: valid ? "ASSET_INTEGRITY_VERIFIED" : "ASSET_INTEGRITY_FAILED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `integrity ${valid ? "verified" : "failed"} for ${input.assetId}`,
      details: { versionId: version.versionId, expectedDigest: input.expectedDigest, actualDigest },
    });

    return {
      valid,
      versionId: version.versionId,
      expectedDigest: input.expectedDigest,
      actualDigest,
    };
  }

  async updateMetadata(input: {
    tenantId: TenantId;
    assetId: AssetId;
    metadata: AssetMetadata;
    tags?: string[];
    actor: AssetActorContext;
  }): Promise<AssetRecord> {
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      asset.metadata = structuredClone(input.metadata);
      if (input.tags) {
        asset.tags = normalizeTags(input.tags);
      }
      asset.updatedAt = nowIso();
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_METADATA_UPDATED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `metadata updated for ${input.assetId}`,
    });

    return this.requireAsset(input.assetId);
  }

  async createCollection(input: {
    tenantId: TenantId;
    name: string;
    description?: string;
    tags?: string[];
    metadata?: AssetMetadata;
    actor: AssetActorContext;
  }): Promise<AssetCollection> {
    const at = nowIso();
    const collection: AssetCollection = {
      collectionId: `asset_collection_${randomUUID()}`,
      tenantId: input.tenantId,
      name: input.name.trim(),
      description: input.description,
      assetIds: [],
      tags: normalizeTags(input.tags),
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: at,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      state.collections.push(collection);
    });

    await this.audit.append({
      eventType: "ASSET_COLLECTION_CREATED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: `collection ${collection.collectionId} created`,
      details: { name: collection.name },
    });

    const found = this.persistence.listCollections(input.tenantId).find((item) => item.collectionId === collection.collectionId);
    if (!found) {
      throw new AssetError("COLLECTION_NOT_FOUND", "collection create failed", false, true, "MEDIUM");
    }
    return found;
  }

  async addAssetToCollection(input: {
    tenantId: TenantId;
    collectionId: string;
    assetId: AssetId;
    actor: AssetActorContext;
  }): Promise<AssetCollection> {
    await this.persistence.mutate((state) => {
      const collection = state.collections.find((item) => item.collectionId === input.collectionId);
      if (!collection) {
        throw new AssetError("COLLECTION_NOT_FOUND", `collection not found: ${input.collectionId}`, false, true, "MEDIUM");
      }

      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId || collection.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", "tenant mismatch for collection membership", false, true, "HIGH");
      }

      if (!collection.assetIds.includes(asset.assetId)) {
        collection.assetIds.push(asset.assetId);
      }
      if (!asset.collections.includes(collection.collectionId)) {
        asset.collections.push(collection.collectionId);
      }

      const at = nowIso();
      collection.updatedAt = at;
      collection.updatedBy = input.actor.actorId;
      asset.updatedAt = at;
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_COLLECTION_MEMBER_ADDED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `asset ${input.assetId} added to collection ${input.collectionId}`,
    });

    const found = this.persistence.listCollections(input.tenantId).find((item) => item.collectionId === input.collectionId);
    if (!found) {
      throw new AssetError("COLLECTION_NOT_FOUND", `collection not found after update: ${input.collectionId}`, false, true, "MEDIUM");
    }
    return found;
  }

  async linkAssets(input: {
    tenantId: TenantId;
    fromAssetId: AssetId;
    toAssetId: AssetId;
    relationshipType: "DERIVED_FROM" | "DEPENDS_ON" | "RELATED" | "THUMBNAIL_OF" | "VARIANT_OF";
    metadata?: AssetMetadata;
    actor: AssetActorContext;
  }): Promise<AssetRelationship> {
    if (input.fromAssetId === input.toAssetId) {
      throw new AssetError("RELATIONSHIP_INVALID", "self relationships are not allowed", false, true, "MEDIUM");
    }

    const relationship: AssetRelationship = {
      relationshipId: `asset_relationship_${randomUUID()}`,
      tenantId: input.tenantId,
      fromAssetId: input.fromAssetId,
      toAssetId: input.toAssetId,
      relationshipType: input.relationshipType,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: nowIso(),
      createdBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const from = state.assets.find((item) => item.assetId === input.fromAssetId);
      const to = state.assets.find((item) => item.assetId === input.toAssetId);
      if (!from || !to) {
        throw new AssetError("ASSET_NOT_FOUND", "relationship assets not found", false, true, "MEDIUM");
      }
      if (from.tenantId !== input.tenantId || to.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", "relationship tenant mismatch", false, true, "HIGH");
      }

      state.relationships.push(relationship);
      from.relationships.push(relationship.relationshipId);
      to.relationships.push(relationship.relationshipId);

      const at = nowIso();
      from.updatedAt = at;
      to.updatedAt = at;
      from.updatedBy = input.actor.actorId;
      to.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_RELATIONSHIP_CREATED",
      tenantId: input.tenantId,
      assetId: input.fromAssetId,
      actor: input.actor,
      message: `relationship ${relationship.relationshipId} created`,
      details: { toAssetId: input.toAssetId, relationshipType: input.relationshipType },
    });

    return relationship;
  }

  async setRetention(input: {
    tenantId: TenantId;
    assetId: AssetId;
    retainUntil?: string;
    legalHold: boolean;
    policyId?: string;
    actor: AssetActorContext;
  }): Promise<AssetRecord> {
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      asset.retention = {
        retainUntil: input.retainUntil,
        legalHold: input.legalHold,
        policyId: input.policyId,
      };
      asset.updatedAt = nowIso();
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_RETENTION_UPDATED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `retention updated for ${input.assetId}`,
    });

    return this.requireAsset(input.assetId);
  }

  async archive(input: { tenantId: TenantId; assetId: AssetId; actor: AssetActorContext }): Promise<AssetRecord> {
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      const at = nowIso();
      asset.lifecycle.status = "ARCHIVED";
      asset.lifecycle.archivedAt = at;
      asset.lifecycle.archivedBy = input.actor.actorId;
      asset.updatedAt = at;
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_ARCHIVED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `asset ${input.assetId} archived`,
    });

    return this.requireAsset(input.assetId);
  }

  async softDelete(input: { tenantId: TenantId; assetId: AssetId; actor: AssetActorContext }): Promise<AssetRecord> {
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      if (asset.retention.legalHold) {
        throw new AssetError("RETENTION_PROTECTED", `asset ${input.assetId} is under legal hold`, false, true, "HIGH");
      }
      if (asset.retention.retainUntil && Date.parse(asset.retention.retainUntil) > Date.now()) {
        throw new AssetError("RETENTION_PROTECTED", `asset ${input.assetId} is retained until ${asset.retention.retainUntil}`, false, true, "HIGH");
      }

      const at = nowIso();
      asset.lifecycle.status = "SOFT_DELETED";
      asset.lifecycle.deletedAt = at;
      asset.lifecycle.deletedBy = input.actor.actorId;
      asset.updatedAt = at;
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_SOFT_DELETED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `asset ${input.assetId} soft-deleted`,
    });

    return this.requireAsset(input.assetId);
  }

  async restore(input: { tenantId: TenantId; assetId: AssetId; actor: AssetActorContext }): Promise<AssetRecord> {
    await this.persistence.mutate((state) => {
      const asset = state.assets.find((item) => item.assetId === input.assetId);
      if (!asset) {
        throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${input.assetId}`, false, true, "MEDIUM");
      }
      if (asset.tenantId !== input.tenantId) {
        throw new AssetError("TENANT_MISMATCH", `tenant mismatch for asset ${input.assetId}`, false, true, "HIGH");
      }

      const at = nowIso();
      asset.lifecycle.status = "ACTIVE";
      asset.lifecycle.restoredAt = at;
      asset.lifecycle.restoredBy = input.actor.actorId;
      asset.updatedAt = at;
      asset.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "ASSET_RESTORED",
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: `asset ${input.assetId} restored`,
    });

    return this.requireAsset(input.assetId);
  }

  private requireAsset(assetId: AssetId): AssetRecord {
    const found = this.persistence.getAsset(assetId);
    if (!found) {
      throw new AssetError("ASSET_NOT_FOUND", `asset not found: ${assetId}`, false, true, "MEDIUM");
    }
    return found;
  }
}
