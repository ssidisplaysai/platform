import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";

export type CatalogSourceType =
  | "SPREADSHEET"
  | "CSV"
  | "WORDPRESS"
  | "WOOCOMMERCE"
  | "API"
  | "SUPPLIER_FEED"
  | "MANUAL"
  | "OTHER";

export type CatalogSource = {
  sourceId: string;
  organizationId: string;
  type: CatalogSourceType;
  name: string;
  externalSystem: string | null;
  configurationReference: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type NewCatalogSourceInput = Omit<CatalogSource, "createdAt" | "updatedAt" | "version">;
export type UpdateCatalogSourceInput = Partial<
  Pick<CatalogSource, "type" | "name" | "externalSystem" | "configurationReference">
>;

export type CatalogImportStatus =
  | "RECEIVED"
  | "PARSED"
  | "MAPPED"
  | "VALIDATED"
  | "PREVIEW_READY"
  | "REVIEWED"
  | "APPROVED"
  | "APPLYING"
  | "APPLIED"
  | "REJECTED"
  | "FAILED";

export type CatalogImportRecordCounts = {
  total: number;
  accepted: number;
  rejected: number;
  warning: number;
};

export type CatalogImportStatusTransition = {
  from: CatalogImportStatus | null;
  to: CatalogImportStatus;
  transitionedAt: string;
  actor: string;
};

export type CatalogDiagnostic = {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  sourceLocator?: SourceLocator;
};

export type CatalogImport = {
  importId: string;
  sourceId: string;
  status: CatalogImportStatus;
  sourceVersion: string;
  contentHash: string;
  schemaVersion: string;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  recordCounts: CatalogImportRecordCounts;
  diagnostics: readonly CatalogDiagnostic[];
  statusHistory: readonly CatalogImportStatusTransition[];
  version: number;
};

export type NewCatalogImportInput = Omit<
  CatalogImport,
  "status" | "completedAt" | "statusHistory" | "version"
>;

export type SourceLocator = {
  sourceUri?: string;
  fileName?: string;
  sheet?: string;
  row?: number;
  column?: string;
  cellRange?: string;
  url?: string;
  externalObjectId?: string;
  externalParentId?: string;
  path?: string;
  recordKey?: string;
};

export type CatalogImportRecordStatus = "OBSERVED" | "MAPPED" | "INVALID" | "RECONCILED";
export type ReconciliationDecision = "UNREVIEWED" | "CREATE" | "MATCH" | "REJECT" | "DEFER";

export type CatalogImportRecord = {
  recordId: string;
  importId: string;
  sourceLocator: SourceLocator;
  rawPayloadHash: string;
  rawPayload: CanonicalJsonValue;
  normalizedCandidate: CanonicalJsonValue | null;
  status: CatalogImportRecordStatus;
  diagnostics: readonly CatalogDiagnostic[];
  reconciliationDecision: ReconciliationDecision;
  createdAt: string;
};

export type NewCatalogImportRecordInput = Omit<CatalogImportRecord, "rawPayloadHash" | "createdAt">;

export type TransformationType =
  | "SOURCE_READ"
  | "COLUMN_MAPPING"
  | "TYPE_NORMALIZATION"
  | "UNIT_NORMALIZATION"
  | "VALUE_NORMALIZATION"
  | "RECONCILIATION"
  | "OPERATOR_OVERRIDE";

export type SourceTransformation = {
  type: TransformationType;
  input: CanonicalJsonValue;
  output: CanonicalJsonValue;
  rule: string;
  ruleVersion: string;
  timestamp: string;
  actor: string | null;
};

export type SourceProvenance = {
  provenanceId: string;
  sourceId: string;
  importId: string;
  importRecordId: string;
  sourceLocator: SourceLocator;
  contentHash: string;
  observedAt: string;
  rawValue: CanonicalJsonValue;
  normalizedValue: CanonicalJsonValue | null;
  transformationChain: readonly SourceTransformation[];
  confidence: number | null;
};

export type NewSourceProvenanceInput = Omit<SourceProvenance, "provenanceId" | "contentHash">;

export type CatalogEntityVersionReference = {
  id: string;
  version: number;
  contentHash?: string | null;
};

export type CatalogRevisionSnapshot = {
  sourceImportIds: readonly string[];
  products: readonly CatalogEntityVersionReference[];
  productFamilies: readonly CatalogEntityVersionReference[];
  variants: readonly CatalogEntityVersionReference[];
  attributeDefinitions: readonly CatalogEntityVersionReference[];
  mediaAssets: readonly CatalogEntityVersionReference[];
  documentAssets: readonly CatalogEntityVersionReference[];
};

export type CatalogRevision = {
  catalogRevisionId: string;
  organizationId: string;
  revisionNumber: number;
  contentHash: string;
  createdAt: string;
  createdBy: string;
  sourceImportIds: readonly string[];
  productIds: readonly string[];
  productFamilyIds: readonly string[];
  variantIds: readonly string[];
  attributeDefinitionIds: readonly string[];
  mediaAssetIds: readonly string[];
  documentAssetIds: readonly string[];
  previousRevisionId: string | null;
  snapshot: CatalogRevisionSnapshot;
  metadata: Readonly<Record<string, string>>;
};

export type NewCatalogRevisionInput = {
  organizationId: string;
  createdBy: string;
  snapshot: CatalogRevisionSnapshot;
  metadata: Readonly<Record<string, string>>;
};

export const CATALOG_IMPORT_TRANSITIONS: Readonly<
  Record<CatalogImportStatus, readonly CatalogImportStatus[]>
> = {
  RECEIVED: ["PARSED", "FAILED"],
  PARSED: ["MAPPED", "FAILED"],
  MAPPED: ["VALIDATED", "FAILED"],
  VALIDATED: ["PREVIEW_READY", "FAILED"],
  PREVIEW_READY: ["REVIEWED", "REJECTED", "FAILED"],
  REVIEWED: ["APPROVED", "REJECTED", "FAILED"],
  APPROVED: ["APPLYING", "FAILED"],
  APPLYING: ["APPLIED", "FAILED"],
  APPLIED: [],
  REJECTED: [],
  FAILED: [],
};

function sortedReferences(
  references: readonly CatalogEntityVersionReference[],
): readonly CatalogEntityVersionReference[] {
  return [...references]
    .map((reference) => ({ ...reference }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
}

export function normalizeCatalogRevisionSnapshot(
  snapshot: CatalogRevisionSnapshot,
): CatalogRevisionSnapshot {
  return {
    sourceImportIds: [...snapshot.sourceImportIds].sort(),
    products: sortedReferences(snapshot.products),
    productFamilies: sortedReferences(snapshot.productFamilies),
    variants: sortedReferences(snapshot.variants),
    attributeDefinitions: sortedReferences(snapshot.attributeDefinitions),
    mediaAssets: sortedReferences(snapshot.mediaAssets),
    documentAssets: sortedReferences(snapshot.documentAssets),
  };
}

export function createCatalogRevisionContentHash(snapshot: CatalogRevisionSnapshot): string {
  return createCanonicalContentHash(normalizeCatalogRevisionSnapshot(snapshot));
}

export function createCatalogSourceId(input: {
  organizationId: string;
  type: CatalogSourceType;
  name: string;
  externalSystem: string | null;
}): string {
  return `catalog-source-${createCanonicalContentHash({
    organizationId: input.organizationId,
    type: input.type,
    name: input.name.trim().toLowerCase(),
    externalSystem: input.externalSystem?.trim().toLowerCase() ?? null,
  }).slice(0, 24)}`;
}

export function createSourceProvenanceIdentity(input: NewSourceProvenanceInput): string {
  return `provenance-${createCanonicalContentHash({
    sourceId: input.sourceId,
    importId: input.importId,
    importRecordId: input.importRecordId,
    sourceLocator: input.sourceLocator,
    observedAt: input.observedAt,
    rawValue: input.rawValue,
    normalizedValue: input.normalizedValue,
    transformationChain: input.transformationChain,
  }).slice(0, 32)}`;
}