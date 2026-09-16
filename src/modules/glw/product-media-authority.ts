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

export type ProductMediaApprovalState = "PENDING" | "APPROVED" | "REJECTED";

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
  depictsActualProduct: boolean;
  productRepresentationAllowed: boolean;
  contextualUseAllowed: boolean;
  applicationUseAllowed: boolean;
  localAtmosphereUseAllowed: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
  hash: string;
  contentBase64: string;
  createdAt: string;
  updatedAt: string;
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

type State = { records: ProductMediaAuthorityRecord[] };
const NAMESPACE = "glw-product-media-authority-v1";
const seed = (): State => ({ records: [] });

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function load() {
  return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
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
  if (existing) return deepClone(existing);
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
    ownerApproval: "PENDING",
    ownerApprovalTimestamp: null,
    ownerPrincipalId: null,
    ownerSessionId: null,
    provenance: input.provenance.trim(),
    authorityClass: input.authorityClass,
    usageScopes: [...new Set(input.usageScopes)],
    depictsActualProduct: input.depictsActualProduct,
    productRepresentationAllowed: false,
    contextualUseAllowed: false,
    applicationUseAllowed: false,
    localAtmosphereUseAllowed: false,
    heroEligible: input.heroEligible,
    altTextAuthority: input.altTextAuthority.trim(),
    captionAuthority: input.captionAuthority.trim(),
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
  const scopes = [...new Set(input.usageScopes)];
  if (!scopes.includes(input.authorityClass)) throw new Error("PRODUCT_MEDIA_AUTHORITY_SCOPE_REQUIRED");
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
  record.depictsActualProduct = input.depictsActualProduct;
  record.productRepresentationAllowed = approved && input.authorityClass === "PRODUCT_AUTHORITY" && input.depictsActualProduct;
  record.contextualUseAllowed = approved && scopes.includes("CONTEXTUAL_IN_USE");
  record.applicationUseAllowed = approved && scopes.includes("APPLICATION_EXPERIENCE");
  record.localAtmosphereUseAllowed = approved && scopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE");
  record.heroEligible = approved && input.heroEligible && record.productRepresentationAllowed;
  record.altTextAuthority = input.altTextAuthority.trim();
  record.captionAuthority = input.captionAuthority.trim();
  record.updatedAt = record.ownerApprovalTimestamp;
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function listProductMediaAuthority(input: { organizationId: string; siteId: string; productId: string }): readonly ProductMediaAuthorityRecord[] {
  assertOutdoorScope(input);
  return deepClone(load().state.records.filter((record) => record.organizationId === input.organizationId
    && record.siteId === input.siteId
    && record.productId === input.productId));
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