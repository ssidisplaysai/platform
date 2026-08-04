export type AssetId = string;
export type TenantId = string;
export type CollectionId = string;
export type RelationshipId = string;

export type AssetType =
  | "FILE"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "CAD"
  | "MODEL_3D"
  | "SOURCE_CODE"
  | "BINARY_PACKAGE"
  | "CERTIFICATE"
  | "FONT"
  | "ICON"
  | "LOGO"
  | "TEMPLATE"
  | "MEDIA"
  | "OTHER";

export type AssetStatus = "ACTIVE" | "ARCHIVED" | "SOFT_DELETED";

export type AssetProviderType = "FILESYSTEM" | "S3_COMPATIBLE" | "AZURE_BLOB" | "GCS" | "OTHER";

export type AssetActorContext = {
  actorId: string;
  occurredAt: string;
  source?: string;
  correlationId?: string;
  causationId?: string;
};

export type AssetMetadataValue = string | number | boolean | null;
export type AssetMetadata = Record<string, AssetMetadataValue>;

export type AssetChecksum = {
  algorithm: "SHA256" | "SHA512";
  digest: string;
  verifiedAt: string;
};

export type AssetVersion = {
  versionId: string;
  sequence: number;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  checksum: AssetChecksum;
  createdAt: string;
  createdBy: string;
  metadata: AssetMetadata;
};

export type AssetRelationship = {
  relationshipId: RelationshipId;
  tenantId: TenantId;
  fromAssetId: AssetId;
  toAssetId: AssetId;
  relationshipType: "DERIVED_FROM" | "DEPENDS_ON" | "RELATED" | "THUMBNAIL_OF" | "VARIANT_OF";
  metadata: AssetMetadata;
  createdAt: string;
  createdBy: string;
};

export type AssetCollection = {
  collectionId: CollectionId;
  tenantId: TenantId;
  name: string;
  description?: string;
  assetIds: AssetId[];
  tags: string[];
  metadata: AssetMetadata;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type AssetRetention = {
  retainUntil?: string;
  legalHold: boolean;
  policyId?: string;
};

export type AssetLifecycle = {
  status: AssetStatus;
  archivedAt?: string;
  archivedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
};

export type AssetRecord = {
  assetId: AssetId;
  tenantId: TenantId;
  type: AssetType;
  displayName: string;
  provider: {
    providerId: string;
    providerType: AssetProviderType;
    bucket?: string;
    region?: string;
  };
  metadata: AssetMetadata;
  tags: string[];
  checksums: AssetChecksum[];
  currentVersionId: string;
  versions: AssetVersion[];
  relationships: RelationshipId[];
  collections: CollectionId[];
  retention: AssetRetention;
  lifecycle: AssetLifecycle;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type AssetAuditRecord = {
  auditId: string;
  eventType: string;
  tenantId: TenantId;
  assetId?: AssetId;
  actor: AssetActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type AssetMetrics = {
  assetsTotal: number;
  activeAssets: number;
  archivedAssets: number;
  softDeletedAssets: number;
  versionsTotal: number;
  checksumVerifications: number;
  integrityFailures: number;
  relationshipsTotal: number;
  collectionsTotal: number;
  assetsInCollections: number;
  retentionProtectedAssets: number;
  auditEvents: number;
  recoveryCount: number;
  corruptStateCount: number;
};

export type AssetHealth = {
  status: "HEALTHY" | "DEGRADED";
  generatedAt: string;
  checks: Array<{
    name: "persistence" | "registry" | "versions" | "integrity" | "relationships" | "collections" | "lifecycle" | "retention";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
};

export type AssetPersistedState = {
  schemaVersion: "1.0.0";
  assets: AssetRecord[];
  relationships: AssetRelationship[];
  collections: AssetCollection[];
  audits: AssetAuditRecord[];
  metrics: AssetMetrics;
};

export function createDefaultAssetMetrics(): AssetMetrics {
  return {
    assetsTotal: 0,
    activeAssets: 0,
    archivedAssets: 0,
    softDeletedAssets: 0,
    versionsTotal: 0,
    checksumVerifications: 0,
    integrityFailures: 0,
    relationshipsTotal: 0,
    collectionsTotal: 0,
    assetsInCollections: 0,
    retentionProtectedAssets: 0,
    auditEvents: 0,
    recoveryCount: 0,
    corruptStateCount: 0,
  };
}

export function createDefaultAssetPersistedState(): AssetPersistedState {
  return {
    schemaVersion: "1.0.0",
    assets: [],
    relationships: [],
    collections: [],
    audits: [],
    metrics: createDefaultAssetMetrics(),
  };
}

export type AssetErrorCode =
  | "ASSET_INVALID"
  | "ASSET_DUPLICATE"
  | "ASSET_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "VERSION_INVALID"
  | "CHECKSUM_MISMATCH"
  | "RETENTION_PROTECTED"
  | "COLLECTION_NOT_FOUND"
  | "RELATIONSHIP_INVALID"
  | "STATE_CORRUPT"
  | "PERSISTENCE_FAILURE"
  | "RECOVERY_FAILURE";

export type AssetErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export class AssetError extends Error {
  constructor(
    public readonly code: AssetErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly auditRequired: boolean,
    public readonly severity: AssetErrorSeverity,
  ) {
    super(message);
    this.name = "AssetError";
  }
}
