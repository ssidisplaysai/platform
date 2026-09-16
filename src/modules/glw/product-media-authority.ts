import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

export const GLW_PRODUCT_MEDIA_AUTHORITY_VERSION = "GLW_PRODUCT_MEDIA_AUTHORITY_V1" as const;
export const OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID = "prod-outdoor-digital-sphere" as const;
export const OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID = "led-display-warehouse" as const;
export const OUTDOOR_DIGITAL_SPHERE_SITE_ID = "site-led-display-warehouse-production" as const;
export const PRODUCT_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION = "EXPLICIT_OWNER_CONFIRMATION_V1" as const;

export type ProductMediaSourceType =
  | "FACTORY_SUPPLIED"
  | "OWNER_SUPPLIED"
  | "OWNER_APPROVED_EXISTING"
  | "GENESIS_GENERATED_CONTEXTUAL"
  | "REFERENCE_ONLY"
  | "UNVERIFIED";

export type ProductMediaAuthorityClass =
  | "PRODUCT_AUTHORITY"
  | "CONTEXTUAL_IN_USE"
  | "APPLICATION_EXPERIENCE"
  | "LOCAL_CONTEXTUAL_ATMOSPHERE";

export type ProductMediaApprovalState = "PENDING_OWNER_APPROVAL" | "APPROVED" | "REJECTED";

export type ProductMediaAuthorityRecord = {
  mediaAuthorityId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dimensions: { width: number; height: number };
  sourceType: ProductMediaSourceType;
  sourceDescription: string;
  ownerApproval: ProductMediaApprovalState;
  ownerApprovalTimestamp: string | null;
  ownerPrincipalId: string | null;
  ownerSessionId: string | null;
  provenance: string;
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  proposedUsageScopes: readonly ProductMediaAuthorityClass[];
  approvedUsageScopes: readonly ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  productRepresentationAllowed: boolean;
  contextualUseAllowed: boolean;
  applicationUseAllowed: boolean;
  localAtmosphereUseAllowed: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
  approvalLifecycleVersion: typeof EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION | null;
  hash: string;
  contentBase64: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductMediaLegacyReconciliationAudit = {
  reconciliationKey: string;
  reconciledAt: string;
  reconciledByPrincipalId: string;
  mediaAuthorityId: string;
  hash: string;
  previousStatus: ProductMediaApprovalState;
  previousApproval: boolean;
  previousPrincipalId: string | null;
  previousApprovalTimestamp: string | null;
  previousAuthorityClass: ProductMediaAuthorityClass;
  previousUsageScopes: readonly ProductMediaAuthorityClass[];
  provenance: string;
  depictsActualProduct: boolean;
  heroEligible: boolean;
};

export type ProductMediaReadiness = {
  contractVersion: typeof GLW_PRODUCT_MEDIA_AUTHORITY_VERSION;
  state: "REFERENCE_COMPOSITION_MEDIA_READY" | "PRODUCT_MEDIA_AUTHORITY_REQUIRED";
  ready: boolean;
  approvedProductAuthorityMediaCount: number;
  approvedContextualMediaCount: number;
  approvedApplicationMediaCount: number;
  approvedLocalAtmosphereMediaCount: number;
  heroAuthorityReady: boolean;
  supportingProductMediaReady: boolean;
  applicationMediaReady: boolean;
  mediaProvenanceReady: boolean;
  productFactAuthorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY";
  productFactsExpanded: false;
  blockers: readonly string[];
};

type State = { records: ProductMediaAuthorityRecord[]; legacyReconciliationAudits?: ProductMediaLegacyReconciliationAudit[] };
const NAMESPACE = "glw-product-media-authority-v1";
const seed = (): State => ({ records: [], legacyReconciliationAudits: [] });

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function load() {
  return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
}

function normalizedRecord(record: ProductMediaAuthorityRecord): ProductMediaAuthorityRecord {
  const ownerApproval = (record.ownerApproval as string) === "PENDING" ? "PENDING_OWNER_APPROVAL" : record.ownerApproval;
  return {
    ...record,
    ownerApproval,
    proposedUsageScopes: [...(record.proposedUsageScopes ?? record.usageScopes)],
    approvedUsageScopes: [...(record.approvedUsageScopes ?? (ownerApproval === "APPROVED" ? record.usageScopes : []))],
    approvalLifecycleVersion: record.approvalLifecycleVersion ?? null,
  };
}

function assertOutdoorScope(input: { organizationId: string; siteId: string; productId: string }): void {
  if (input.organizationId !== OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID
    || input.siteId !== OUTDOOR_DIGITAL_SPHERE_SITE_ID
    || input.productId !== OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID) {
    throw new Error("PRODUCT_MEDIA_SCOPE_DENIED");
  }
}

function extension(mimeType: ProductMediaAuthorityRecord["mimeType"]): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

export async function intakeProductMedia(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  originalFilename: string;
  mimeType: string;
  bytes: Buffer;
  sourceType: ProductMediaSourceType;
  sourceDescription: string;
  provenance: string;
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
  now?: Date;
}): Promise<ProductMediaAuthorityRecord> {
  assertOutdoorScope(input);
  if (!(["image/jpeg", "image/png", "image/webp"] as const).includes(input.mimeType as ProductMediaAuthorityRecord["mimeType"])) throw new Error("PRODUCT_MEDIA_MIME_TYPE_INVALID");
  if (input.bytes.length === 0 || input.bytes.length > PRODUCT_MEDIA_MAX_BYTES) throw new Error("PRODUCT_MEDIA_SIZE_INVALID");
  required(input.originalFilename, "PRODUCT_MEDIA_FILENAME_REQUIRED");
  required(input.sourceDescription, "PRODUCT_MEDIA_SOURCE_DESCRIPTION_REQUIRED");
  required(input.provenance, "PRODUCT_MEDIA_PROVENANCE_REQUIRED");
  required(input.altTextAuthority, "PRODUCT_MEDIA_ALT_TEXT_REQUIRED");
  const metadata = await sharp(input.bytes).metadata();
  if (!metadata.width || !metadata.height || metadata.format === "svg") throw new Error("PRODUCT_MEDIA_DIMENSIONS_INVALID");
  const hash = createHash("sha256").update(input.bytes).digest("hex");
  const mediaAuthorityId = `product-media-${input.productId}-${hash.slice(0, 20)}`;
  const loaded = load();
  const existing = loaded.state.records.find((record) => record.mediaAuthorityId === mediaAuthorityId);
  if (existing) return deepClone(normalizedRecord(existing));
  const timestamp = (input.now ?? new Date()).toISOString();
  const record: ProductMediaAuthorityRecord = {
    mediaAuthorityId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    productId: input.productId,
    originalFilename: input.originalFilename.trim(),
    storedFilename: `${mediaAuthorityId}.${extension(input.mimeType as ProductMediaAuthorityRecord["mimeType"])}`,
    mimeType: input.mimeType as ProductMediaAuthorityRecord["mimeType"],
    dimensions: { width: metadata.width, height: metadata.height },
    sourceType: input.sourceType,
    sourceDescription: input.sourceDescription.trim(),
    ownerApproval: "PENDING_OWNER_APPROVAL",
    ownerApprovalTimestamp: null,
    ownerPrincipalId: null,
    ownerSessionId: null,
    provenance: input.provenance.trim(),
    authorityClass: input.authorityClass,
    usageScopes: [...new Set(input.usageScopes)],
    proposedUsageScopes: [...new Set(input.usageScopes)],
    approvedUsageScopes: [],
    depictsActualProduct: false,
    productRepresentationAllowed: false,
    contextualUseAllowed: false,
    applicationUseAllowed: false,
    localAtmosphereUseAllowed: false,
    heroEligible: false,
    altTextAuthority: input.altTextAuthority.trim(),
    captionAuthority: input.captionAuthority.trim(),
    approvalLifecycleVersion: null,
    hash,
    contentBase64: input.bytes.toString("base64"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  loaded.state.records.push(record);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function reviewProductMedia(input: {
  mediaAuthorityId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  decision: "APPROVE" | "REJECT";
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
  authorityAndScopesConfirmed: boolean;
  localAtmosphereConfirmed: boolean;
  principalId: string;
  sessionId: string;
  now?: Date;
}): ProductMediaAuthorityRecord {
  assertOutdoorScope(input);
  required(input.principalId, "PRODUCT_MEDIA_OWNER_PRINCIPAL_REQUIRED");
  required(input.sessionId, "PRODUCT_MEDIA_OWNER_SESSION_REQUIRED");
  required(input.altTextAuthority, "PRODUCT_MEDIA_ALT_TEXT_REQUIRED");
  const loaded = load();
  const record = loaded.state.records.find((candidate) => candidate.mediaAuthorityId === input.mediaAuthorityId
    && candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId
    && candidate.productId === input.productId);
  if (!record) throw new Error("PRODUCT_MEDIA_AUTHORITY_NOT_FOUND");
  if (record.ownerApproval === "APPROVED") throw new Error("PRODUCT_MEDIA_APPROVAL_ALREADY_FINAL");
  const scopes = [...new Set(input.usageScopes)];
  if (!scopes.includes(input.authorityClass)) throw new Error("PRODUCT_MEDIA_AUTHORITY_SCOPE_REQUIRED");
  if (input.decision === "APPROVE" && !input.authorityAndScopesConfirmed) throw new Error("PRODUCT_MEDIA_REVIEW_CONFIRMATION_REQUIRED");
  if (input.decision === "APPROVE" && scopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE") && !input.localAtmosphereConfirmed) throw new Error("LOCAL_ATMOSPHERE_CONFIRMATION_REQUIRED");
  const groundedProductSource = (["FACTORY_SUPPLIED", "OWNER_SUPPLIED", "OWNER_APPROVED_EXISTING"] as ProductMediaSourceType[]).includes(record.sourceType);
  if (input.decision === "APPROVE" && input.authorityClass === "PRODUCT_AUTHORITY" && (!groundedProductSource || !input.depictsActualProduct)) {
    throw new Error("PRODUCT_AUTHORITY_REQUIRES_OWNER_APPROVED_GROUNDED_PRODUCT_MEDIA");
  }
  if (input.decision === "APPROVE" && record.sourceType === "GENESIS_GENERATED_CONTEXTUAL" && input.depictsActualProduct) {
    throw new Error("GENERATED_MEDIA_CANNOT_ASSERT_ACTUAL_PRODUCT");
  }
  const approved = input.decision === "APPROVE";
  record.ownerApproval = approved ? "APPROVED" : "REJECTED";
  record.ownerApprovalTimestamp = (input.now ?? new Date()).toISOString();
  record.ownerPrincipalId = input.principalId;
  record.ownerSessionId = input.sessionId;
  record.authorityClass = input.authorityClass;
  record.usageScopes = scopes;
  record.proposedUsageScopes = scopes;
  record.approvedUsageScopes = approved ? scopes : [];
  record.depictsActualProduct = input.depictsActualProduct;
  record.productRepresentationAllowed = approved && input.authorityClass === "PRODUCT_AUTHORITY" && input.depictsActualProduct;
  record.contextualUseAllowed = approved && scopes.includes("CONTEXTUAL_IN_USE");
  record.applicationUseAllowed = approved && scopes.includes("APPLICATION_EXPERIENCE");
  record.localAtmosphereUseAllowed = approved && scopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE");
  record.heroEligible = approved && input.heroEligible && record.productRepresentationAllowed;
  record.altTextAuthority = input.altTextAuthority.trim();
  record.captionAuthority = input.captionAuthority.trim();
  record.approvalLifecycleVersion = approved ? EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION : null;
  record.updatedAt = record.ownerApprovalTimestamp;
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function reconcileLegacyProductMediaApprovals(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  targets: readonly { mediaAuthorityId: string; hash: string }[];
  principalId: string;
  now?: Date;
}): { records: readonly ProductMediaAuthorityRecord[]; audits: readonly ProductMediaLegacyReconciliationAudit[]; mutated: boolean } {
  assertOutdoorScope(input);
  required(input.principalId, "PRODUCT_MEDIA_RECONCILIATION_PRINCIPAL_REQUIRED");
  const loaded = load();
  const audits = loaded.state.legacyReconciliationAudits ?? [];
  const reconciledRecords: ProductMediaAuthorityRecord[] = [];
  const createdAudits: ProductMediaLegacyReconciliationAudit[] = [];
  const timestamp = (input.now ?? new Date()).toISOString();

  for (const target of input.targets) {
    const record = loaded.state.records.find((candidate) => candidate.mediaAuthorityId === target.mediaAuthorityId && candidate.hash === target.hash
      && candidate.organizationId === input.organizationId && candidate.siteId === input.siteId && candidate.productId === input.productId);
    if (!record) throw new Error("PRODUCT_MEDIA_LEGACY_RECONCILIATION_TARGET_NOT_FOUND");
    const reconciliationKey = `${record.mediaAuthorityId}:${record.hash}:${EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION}`;
    const existingAudit = audits.find((audit) => audit.reconciliationKey === reconciliationKey);
    if (existingAudit) {
      reconciledRecords.push(record);
      continue;
    }
    if (record.ownerApproval !== "APPROVED" || record.approvalLifecycleVersion === EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION) {
      throw new Error("PRODUCT_MEDIA_LEGACY_RECONCILIATION_CONDITION_NOT_MET");
    }
    const previousScopes = [...(record.approvedUsageScopes ?? record.usageScopes)];
    const audit: ProductMediaLegacyReconciliationAudit = {
      reconciliationKey,
      reconciledAt: timestamp,
      reconciledByPrincipalId: input.principalId,
      mediaAuthorityId: record.mediaAuthorityId,
      hash: record.hash,
      previousStatus: record.ownerApproval,
      previousApproval: true,
      previousPrincipalId: record.ownerPrincipalId,
      previousApprovalTimestamp: record.ownerApprovalTimestamp,
      previousAuthorityClass: record.authorityClass,
      previousUsageScopes: previousScopes,
      provenance: record.provenance,
      depictsActualProduct: record.depictsActualProduct,
      heroEligible: record.heroEligible,
    };
    record.ownerApproval = "PENDING_OWNER_APPROVAL";
    record.ownerApprovalTimestamp = null;
    record.ownerPrincipalId = null;
    record.ownerSessionId = null;
    record.proposedUsageScopes = [...new Set(record.proposedUsageScopes ?? record.usageScopes)];
    record.approvedUsageScopes = [];
    record.productRepresentationAllowed = false;
    record.contextualUseAllowed = false;
    record.applicationUseAllowed = false;
    record.localAtmosphereUseAllowed = false;
    record.depictsActualProduct = false;
    record.heroEligible = false;
    record.approvalLifecycleVersion = null;
    record.updatedAt = timestamp;
    audits.push(audit);
    createdAudits.push(audit);
    reconciledRecords.push(record);
  }

  if (createdAudits.length > 0) {
    loaded.state.legacyReconciliationAudits = audits;
    savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  }
  return { records: deepClone(reconciledRecords), audits: deepClone(createdAudits.length > 0 ? createdAudits : audits.filter((audit) => input.targets.some((target) => audit.mediaAuthorityId === target.mediaAuthorityId && audit.hash === target.hash))), mutated: createdAudits.length > 0 };
}

export function listProductMediaAuthority(input: { organizationId: string; siteId: string; productId: string }): readonly ProductMediaAuthorityRecord[] {
  assertOutdoorScope(input);
  return deepClone(load().state.records.filter((record) => record.organizationId === input.organizationId
    && record.siteId === input.siteId
    && record.productId === input.productId).map(normalizedRecord));
}

export function getProductMediaAuthorityContent(input: { mediaAuthorityId: string; organizationId: string; siteId: string; productId: string }): { bytes: Buffer; mimeType: string; hash: string } | null {
  const record = listProductMediaAuthority(input).find((candidate) => candidate.mediaAuthorityId === input.mediaAuthorityId);
  return record ? { bytes: Buffer.from(record.contentBase64, "base64"), mimeType: record.mimeType, hash: record.hash } : null;
}

export function evaluateProductMediaReadiness(records: readonly ProductMediaAuthorityRecord[]): ProductMediaReadiness {
  const approved = records.filter((record) => record.ownerApproval === "APPROVED");
  const product = approved.filter((record) => record.authorityClass === "PRODUCT_AUTHORITY" && record.productRepresentationAllowed);
  const contextual = approved.filter((record) => record.contextualUseAllowed);
  const application = approved.filter((record) => record.applicationUseAllowed || (record.sourceType === "GENESIS_GENERATED_CONTEXTUAL" && record.authorityClass === "APPLICATION_EXPERIENCE"));
  const local = approved.filter((record) => record.localAtmosphereUseAllowed);
  const hero = product.find((record) => record.heroEligible) ?? null;
  const supporting = approved.find((record) => record.mediaAuthorityId !== hero?.mediaAuthorityId
    && (record.productRepresentationAllowed || record.contextualUseAllowed)) ?? null;
  const mediaProvenanceReady = approved.length > 0 && approved.every((record) => Boolean(record.provenance.trim()) && /^[0-9a-f]{64}$/.test(record.hash));
  const blockers = [
    ...(!hero ? ["PRODUCT_AUTHORITY_HERO_REQUIRED"] : []),
    ...(!supporting ? ["SUPPORTING_PRODUCT_OR_CONTEXTUAL_MEDIA_REQUIRED"] : []),
    ...(application.length === 0 ? ["APPLICATION_EXPERIENCE_MEDIA_REQUIRED"] : []),
    ...(!mediaProvenanceReady ? ["MEDIA_PROVENANCE_REQUIRED"] : []),
  ];
  return {
    contractVersion: GLW_PRODUCT_MEDIA_AUTHORITY_VERSION,
    state: blockers.length ? "PRODUCT_MEDIA_AUTHORITY_REQUIRED" : "REFERENCE_COMPOSITION_MEDIA_READY",
    ready: blockers.length === 0,
    approvedProductAuthorityMediaCount: product.length,
    approvedContextualMediaCount: contextual.length,
    approvedApplicationMediaCount: application.length,
    approvedLocalAtmosphereMediaCount: local.length,
    heroAuthorityReady: Boolean(hero),
    supportingProductMediaReady: Boolean(supporting),
    applicationMediaReady: application.length > 0,
    mediaProvenanceReady,
    productFactAuthorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
    productFactsExpanded: false,
    blockers,
  };
}

export function resetProductMediaAuthorityForTests(): void {
  resetPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
}