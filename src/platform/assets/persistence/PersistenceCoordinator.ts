import {
  AssetError,
  createDefaultAssetMetrics,
  createDefaultAssetPersistedState,
  type AssetAuditRecord,
  type AssetCollection,
  type AssetId,
  type AssetMetrics,
  type AssetPersistedState,
  type AssetRecord,
  type AssetRelationship,
  type TenantId,
} from "../contracts";
import type { AssetStore } from "./types";

function computeMetrics(state: AssetPersistedState): AssetMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultAssetMetrics());
  metrics.assetsTotal = state.assets.length;
  metrics.activeAssets = state.assets.filter((asset) => asset.lifecycle.status === "ACTIVE").length;
  metrics.archivedAssets = state.assets.filter((asset) => asset.lifecycle.status === "ARCHIVED").length;
  metrics.softDeletedAssets = state.assets.filter((asset) => asset.lifecycle.status === "SOFT_DELETED").length;
  metrics.versionsTotal = state.assets.reduce((count, asset) => count + asset.versions.length, 0);
  metrics.relationshipsTotal = state.relationships.length;
  metrics.collectionsTotal = state.collections.length;
  metrics.assetsInCollections = state.collections.reduce((count, collection) => count + collection.assetIds.length, 0);
  metrics.retentionProtectedAssets = state.assets.filter((asset) => Boolean(asset.retention.retainUntil) || asset.retention.legalHold).length;
  metrics.auditEvents = state.audits.length;
  return metrics;
}

function validateStateOrThrow(state: AssetPersistedState): void {
  if (state.schemaVersion !== "1.0.0") {
    throw new AssetError("STATE_CORRUPT", "unsupported asset state schema", false, true, "CRITICAL");
  }

  const seenAssetIds = new Set<string>();
  for (const asset of state.assets) {
    if (!asset.assetId || !asset.tenantId || !asset.displayName || asset.versions.length === 0) {
      throw new AssetError("STATE_CORRUPT", `invalid asset record: ${asset.assetId}`, false, true, "CRITICAL");
    }

    if (seenAssetIds.has(asset.assetId)) {
      throw new AssetError("STATE_CORRUPT", `duplicate asset id in state: ${asset.assetId}`, false, true, "CRITICAL");
    }
    seenAssetIds.add(asset.assetId);

    const versionIds = new Set<string>();
    for (const version of asset.versions) {
      if (!version.versionId || !version.storageKey || !version.checksum.digest) {
        throw new AssetError("STATE_CORRUPT", `invalid version in ${asset.assetId}`, false, true, "CRITICAL");
      }
      if (versionIds.has(version.versionId)) {
        throw new AssetError("STATE_CORRUPT", `duplicate version id in ${asset.assetId}`, false, true, "CRITICAL");
      }
      versionIds.add(version.versionId);
    }

    if (!versionIds.has(asset.currentVersionId)) {
      throw new AssetError("STATE_CORRUPT", `currentVersionId missing in ${asset.assetId}`, false, true, "CRITICAL");
    }
  }

  const collectionIds = new Set(state.collections.map((item) => item.collectionId));
  for (const collection of state.collections) {
    if (!collection.collectionId || !collection.tenantId || !collection.name) {
      throw new AssetError("STATE_CORRUPT", `invalid collection: ${collection.collectionId}`, false, true, "CRITICAL");
    }
    for (const assetId of collection.assetIds) {
      if (!seenAssetIds.has(assetId)) {
        throw new AssetError("STATE_CORRUPT", `collection references unknown asset: ${assetId}`, false, true, "CRITICAL");
      }
    }
  }

  for (const relationship of state.relationships) {
    if (!relationship.relationshipId || !relationship.tenantId) {
      throw new AssetError("STATE_CORRUPT", `invalid relationship: ${relationship.relationshipId}`, false, true, "CRITICAL");
    }
    if (!seenAssetIds.has(relationship.fromAssetId) || !seenAssetIds.has(relationship.toAssetId)) {
      throw new AssetError("STATE_CORRUPT", `relationship references unknown assets: ${relationship.relationshipId}`, false, true, "CRITICAL");
    }
  }

  for (const asset of state.assets) {
    for (const collectionId of asset.collections) {
      if (!collectionIds.has(collectionId)) {
        throw new AssetError("STATE_CORRUPT", `asset references unknown collection: ${collectionId}`, false, true, "CRITICAL");
      }
    }
  }
}

export class PersistenceCoordinator {
  private state: AssetPersistedState = createDefaultAssetPersistedState();

  constructor(private readonly store: AssetStore) {}

  async load(): Promise<void> {
    try {
      this.state = await this.store.load();
      validateStateOrThrow(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      await this.store.save(this.state);
    } catch (error) {
      if (error instanceof AssetError) {
        if (this.state?.metrics) {
          this.state.metrics.corruptStateCount += 1;
        }
        throw error;
      }
      throw new AssetError("RECOVERY_FAILURE", "asset recovery failed", false, true, "CRITICAL");
    }
  }

  snapshot(): AssetPersistedState {
    return structuredClone(this.state);
  }

  listAssets(tenantId?: TenantId): AssetRecord[] {
    return this.state.assets
      .filter((asset) => (tenantId ? asset.tenantId === tenantId : true))
      .map((asset) => structuredClone(asset));
  }

  getAsset(assetId: AssetId): AssetRecord | undefined {
    const found = this.state.assets.find((asset) => asset.assetId === assetId);
    return found ? structuredClone(found) : undefined;
  }

  listRelationships(tenantId?: TenantId): AssetRelationship[] {
    return this.state.relationships
      .filter((relationship) => (tenantId ? relationship.tenantId === tenantId : true))
      .map((relationship) => structuredClone(relationship));
  }

  listCollections(tenantId?: TenantId): AssetCollection[] {
    return this.state.collections
      .filter((collection) => (tenantId ? collection.tenantId === tenantId : true))
      .map((collection) => structuredClone(collection));
  }

  async mutate(mutator: (state: AssetPersistedState) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next);
    validateStateOrThrow(next);
    next.metrics = computeMetrics(next);

    try {
      await this.store.save(next);
    } catch {
      throw new AssetError("PERSISTENCE_FAILURE", "asset persistence save failed", true, true, "HIGH");
    }

    this.state = next;
  }

  async appendAudit(record: AssetAuditRecord): Promise<void> {
    await this.mutate((state) => {
      state.audits.push(record);
    });
  }

  async incrementChecksumVerifications(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.checksumVerifications += 1;
    });
  }

  async incrementIntegrityFailures(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.integrityFailures += 1;
    });
  }
}
