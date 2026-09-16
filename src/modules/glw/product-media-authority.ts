import "server-only";

import { createHash, randomUUID } from "node:crypto";
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
export const PRODUCT_MEDIA_HERO_AUTHORITY_VERSION = "PRODUCT_MEDIA_HERO_OWNER_AUTHORITY_V1" as const;
export const PRODUCT_MEDIA_HERO_PREFLIGHT_LIFETIME_SECONDS = 120;
export const PRODUCT_MEDIA_HERO_GRANT_LIFETIME_SECONDS = 300;

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
  localAtmosphereStateCodes: readonly string[];
  heroEligible: boolean;
  heroSelected: boolean;
  heroSelectedBy: string | null;
  heroSelectedAt: string | null;
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

export type ProductMediaScopeCorrectionAudit = {
  correctionKey: string;
  correctedAt: string;
  correctedByPrincipalId: string;
  mediaAuthorityId: string;
  hash: string;
  ownerApproval: ProductMediaApprovalState;
  ownerPrincipalId: string | null;
  ownerApprovalTimestamp: string | null;
  removedScope: ProductMediaAuthorityClass;
  previousApprovedUsageScopes: readonly ProductMediaAuthorityClass[];
  correctedApprovedUsageScopes: readonly ProductMediaAuthorityClass[];
  provenance: string;
  reason: string;
};

type ProductMediaHeroContext = {
  principalId: string;
  principalSessionId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  mediaAuthorityId: string;
  hash: string;
  exactRuntime: string;
  expectedCurrentHeroId: string | null;
  replacementConfirmed: boolean;
};

export type ProductMediaHeroPreflightReceipt = ProductMediaHeroContext & {
  receiptId: string;
  issuedAt: string;
  expiresAt: string;
  authorizedGrantId: string | null;
};

export type ProductMediaHeroGrant = ProductMediaHeroContext & {
  grantId: string;
  preflightReceiptId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  status: "ACTIVE" | "CONSUMED";
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

type State = { records: ProductMediaAuthorityRecord[]; legacyReconciliationAudits?: ProductMediaLegacyReconciliationAudit[]; scopeCorrectionAudits?: ProductMediaScopeCorrectionAudit[]; heroPreflightReceipts?: ProductMediaHeroPreflightReceipt[]; heroGrants?: ProductMediaHeroGrant[] };
const NAMESPACE = "glw-product-media-authority-v1";
const seed = (): State => ({ records: [], legacyReconciliationAudits: [], scopeCorrectionAudits: [], heroPreflightReceipts: [], heroGrants: [] });

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
    localAtmosphereStateCodes: [...(record.localAtmosphereStateCodes ?? [])],
    heroSelected: record.heroSelected ?? record.heroEligible ?? false,
    heroSelectedBy: record.heroSelectedBy ?? (record.heroEligible ? record.ownerPrincipalId : null),
    heroSelectedAt: record.heroSelectedAt ?? (record.heroEligible ? record.ownerApprovalTimestamp : null),
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
    localAtmosphereStateCodes: [],
    heroEligible: false,
    heroSelected: false,
    heroSelectedBy: null,
    heroSelectedAt: null,
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
  localAtmosphereStateCodes?: readonly string[];
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
  const localAtmosphereStateCodes = [...new Set((input.localAtmosphereStateCodes ?? []).map((stateCode) => stateCode.trim().toUpperCase()).filter((stateCode) => /^[A-Z]{2}$/.test(stateCode)))];
  if (input.decision === "APPROVE" && scopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE") && localAtmosphereStateCodes.length === 0) throw new Error("LOCAL_ATMOSPHERE_GEOGRAPHY_REQUIRED");
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
  record.localAtmosphereUseAllowed = approved && scopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE") && localAtmosphereStateCodes.length > 0;
  record.localAtmosphereStateCodes = record.localAtmosphereUseAllowed ? localAtmosphereStateCodes : [];
  record.heroEligible = false;
  record.heroSelected = false;
  record.heroSelectedBy = null;
  record.heroSelectedAt = null;
  record.altTextAuthority = input.altTextAuthority.trim();
  record.captionAuthority = input.captionAuthority.trim();
  record.approvalLifecycleVersion = approved ? EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION : null;
  record.updatedAt = record.ownerApprovalTimestamp;
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function isProductMediaHeroSelectable(record: ProductMediaAuthorityRecord): boolean {
  const scopes = record.approvedUsageScopes ?? record.usageScopes;
  return record.ownerApproval === "APPROVED"
    && record.authorityClass === "PRODUCT_AUTHORITY"
    && scopes.includes("PRODUCT_AUTHORITY")
    && record.depictsActualProduct
    && record.productRepresentationAllowed;
}

function heroContext(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  mediaAuthorityId: string;
  hash: string;
  exactRuntime: string;
  principalId: string;
  principalSessionId: string;
  replacementConfirmed: boolean;
}, state: State): ProductMediaHeroContext {
  assertOutdoorScope(input);
  required(input.principalId, "PRODUCT_MEDIA_HERO_PRINCIPAL_REQUIRED");
  required(input.principalSessionId, "PRODUCT_MEDIA_HERO_SESSION_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(input.exactRuntime)) throw new Error("PRODUCT_MEDIA_HERO_RUNTIME_INVALID");
  if (!/^[0-9a-f]{64}$/.test(input.hash)) throw new Error("PRODUCT_MEDIA_HERO_HASH_INVALID");
  const record = state.records.find((candidate) => candidate.mediaAuthorityId === input.mediaAuthorityId && candidate.hash === input.hash
    && candidate.organizationId === input.organizationId && candidate.siteId === input.siteId && candidate.productId === input.productId);
  if (!record) throw new Error("PRODUCT_MEDIA_HERO_TARGET_NOT_FOUND");
  if (!isProductMediaHeroSelectable(normalizedRecord(record))) throw new Error("PRODUCT_MEDIA_HERO_TARGET_NOT_SELECTABLE");
  const currentHero = state.records.find((candidate) => candidate.organizationId === input.organizationId && candidate.siteId === input.siteId
    && candidate.productId === input.productId && (candidate.heroSelected ?? candidate.heroEligible)) ?? null;
  if (currentHero && currentHero.mediaAuthorityId !== record.mediaAuthorityId && !input.replacementConfirmed) throw new Error("PRODUCT_MEDIA_HERO_REPLACEMENT_CONFIRMATION_REQUIRED");
  return { ...input, expectedCurrentHeroId: currentHero?.mediaAuthorityId ?? null };
}

function heroContextMatches(left: ProductMediaHeroContext, right: ProductMediaHeroContext): boolean {
  return left.principalId === right.principalId && left.principalSessionId === right.principalSessionId
    && left.organizationId === right.organizationId && left.siteId === right.siteId && left.productId === right.productId
    && left.mediaAuthorityId === right.mediaAuthorityId && left.hash === right.hash && left.exactRuntime === right.exactRuntime
    && left.expectedCurrentHeroId === right.expectedCurrentHeroId && left.replacementConfirmed === right.replacementConfirmed;
}

export function issueProductMediaHeroPreflight(input: Parameters<typeof heroContext>[0] & { now?: Date }): ProductMediaHeroPreflightReceipt {
  const loaded = load();
  const now = input.now ?? new Date();
  const context = heroContext(input, loaded.state);
  const receipt: ProductMediaHeroPreflightReceipt = { ...context, receiptId: `product-media-hero-preflight-${randomUUID()}`, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + PRODUCT_MEDIA_HERO_PREFLIGHT_LIFETIME_SECONDS * 1000).toISOString(), authorizedGrantId: null };
  (loaded.state.heroPreflightReceipts ??= []).push(receipt);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(receipt);
}

export function issueProductMediaHeroGrant(input: Parameters<typeof heroContext>[0] & { preflightReceiptId: string; now?: Date }): ProductMediaHeroGrant {
  const loaded = load();
  const now = input.now ?? new Date();
  const context = heroContext(input, loaded.state);
  const receipt = (loaded.state.heroPreflightReceipts ?? []).find((candidate) => candidate.receiptId === input.preflightReceiptId);
  if (!receipt) throw new Error("PRODUCT_MEDIA_HERO_PREFLIGHT_NOT_FOUND");
  if (receipt.authorizedGrantId) throw new Error("PRODUCT_MEDIA_HERO_PREFLIGHT_ALREADY_AUTHORIZED");
  if (new Date(receipt.expiresAt) <= now) throw new Error("PRODUCT_MEDIA_HERO_PREFLIGHT_EXPIRED");
  if (!heroContextMatches(receipt, context)) throw new Error("PRODUCT_MEDIA_HERO_PREFLIGHT_CONTEXT_MISMATCH");
  const grant: ProductMediaHeroGrant = { ...context, grantId: `product-media-hero-grant-${randomUUID()}`, preflightReceiptId: receipt.receiptId, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + PRODUCT_MEDIA_HERO_GRANT_LIFETIME_SECONDS * 1000).toISOString(), consumedAt: null, status: "ACTIVE" };
  receipt.authorizedGrantId = grant.grantId;
  (loaded.state.heroGrants ??= []).push(grant);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(grant);
}

export function selectProductMediaHero(input: Parameters<typeof heroContext>[0] & { preflightReceiptId: string; grantId: string; now?: Date }): { record: ProductMediaAuthorityRecord; previousHeroId: string | null; readiness: ProductMediaReadiness } {
  const loaded = load();
  const now = input.now ?? new Date();
  const context = heroContext(input, loaded.state);
  const grant = (loaded.state.heroGrants ?? []).find((candidate) => candidate.grantId === input.grantId);
  if (!grant) throw new Error("PRODUCT_MEDIA_HERO_GRANT_NOT_FOUND");
  if (grant.preflightReceiptId !== input.preflightReceiptId) throw new Error("PRODUCT_MEDIA_HERO_PREFLIGHT_GRANT_MISMATCH");
  if (grant.status === "CONSUMED") throw new Error("PRODUCT_MEDIA_HERO_GRANT_CONSUMED");
  if (new Date(grant.expiresAt) <= now) throw new Error("PRODUCT_MEDIA_HERO_GRANT_EXPIRED");
  if (!heroContextMatches(grant, context)) throw new Error("PRODUCT_MEDIA_HERO_GRANT_CONTEXT_MISMATCH");
  const selected = loaded.state.records.find((record) => record.mediaAuthorityId === input.mediaAuthorityId && record.hash === input.hash)!;
  const previousHero = loaded.state.records.find((record) => record.organizationId === input.organizationId && record.siteId === input.siteId && record.productId === input.productId && (record.heroSelected ?? record.heroEligible)) ?? null;
  for (const record of loaded.state.records.filter((candidate) => candidate.organizationId === input.organizationId && candidate.siteId === input.siteId && candidate.productId === input.productId)) {
    const isSelected = record.mediaAuthorityId === selected.mediaAuthorityId;
    record.heroEligible = isSelected;
    record.heroSelected = isSelected;
    record.heroSelectedBy = isSelected ? input.principalId : null;
    record.heroSelectedAt = isSelected ? now.toISOString() : null;
    if (isSelected || record.mediaAuthorityId === previousHero?.mediaAuthorityId) record.updatedAt = now.toISOString();
  }
  grant.status = "CONSUMED";
  grant.consumedAt = now.toISOString();
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  const records = loaded.state.records.filter((record) => record.organizationId === input.organizationId && record.siteId === input.siteId && record.productId === input.productId).map(normalizedRecord);
  return { record: deepClone(normalizedRecord(selected)), previousHeroId: previousHero?.mediaAuthorityId ?? null, readiness: evaluateProductMediaReadiness(records) };
}

export function correctApprovedProductMediaUsageScope(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  targets: readonly { mediaAuthorityId: string; hash: string }[];
  removedScope: "LOCAL_CONTEXTUAL_ATMOSPHERE";
  reason: string;
  principalId: string;
  now?: Date;
}): { records: readonly ProductMediaAuthorityRecord[]; audits: readonly ProductMediaScopeCorrectionAudit[]; mutated: boolean } {
  assertOutdoorScope(input);
  required(input.principalId, "PRODUCT_MEDIA_SCOPE_CORRECTION_PRINCIPAL_REQUIRED");
  const reason = required(input.reason, "PRODUCT_MEDIA_SCOPE_CORRECTION_REASON_REQUIRED");
  const loaded = load();
  const audits = loaded.state.scopeCorrectionAudits ?? [];
  const correctedRecords: ProductMediaAuthorityRecord[] = [];
  const createdAudits: ProductMediaScopeCorrectionAudit[] = [];
  const timestamp = (input.now ?? new Date()).toISOString();
  for (const target of input.targets) {
    const record = loaded.state.records.find((candidate) => candidate.mediaAuthorityId === target.mediaAuthorityId && candidate.hash === target.hash
      && candidate.organizationId === input.organizationId && candidate.siteId === input.siteId && candidate.productId === input.productId);
    if (!record) throw new Error("PRODUCT_MEDIA_SCOPE_CORRECTION_TARGET_NOT_FOUND");
    const correctionKey = `${record.mediaAuthorityId}:${record.hash}:${input.removedScope}`;
    const existingAudit = audits.find((audit) => audit.correctionKey === correctionKey);
    if (existingAudit) {
      correctedRecords.push(normalizedRecord(record));
      continue;
    }
    const previousApprovedUsageScopes = [...(record.approvedUsageScopes ?? (record.ownerApproval === "APPROVED" ? record.usageScopes : []))];
    if (record.ownerApproval !== "APPROVED" || !previousApprovedUsageScopes.includes(input.removedScope)) throw new Error("PRODUCT_MEDIA_SCOPE_CORRECTION_CONDITION_NOT_MET");
    const correctedApprovedUsageScopes = previousApprovedUsageScopes.filter((scope) => scope !== input.removedScope);
    const audit: ProductMediaScopeCorrectionAudit = {
      correctionKey,
      correctedAt: timestamp,
      correctedByPrincipalId: input.principalId,
      mediaAuthorityId: record.mediaAuthorityId,
      hash: record.hash,
      ownerApproval: record.ownerApproval,
      ownerPrincipalId: record.ownerPrincipalId,
      ownerApprovalTimestamp: record.ownerApprovalTimestamp,
      removedScope: input.removedScope,
      previousApprovedUsageScopes,
      correctedApprovedUsageScopes,
      provenance: record.provenance,
      reason,
    };
    record.usageScopes = correctedApprovedUsageScopes;
    record.approvedUsageScopes = correctedApprovedUsageScopes;
    record.localAtmosphereUseAllowed = false;
    record.localAtmosphereStateCodes = [];
    record.updatedAt = timestamp;
    audits.push(audit);
    createdAudits.push(audit);
    correctedRecords.push(normalizedRecord(record));
  }
  if (createdAudits.length > 0) {
    loaded.state.scopeCorrectionAudits = audits;
    savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  }
  return { records: deepClone(correctedRecords), audits: deepClone(createdAudits.length > 0 ? createdAudits : audits.filter((audit) => input.targets.some((target) => audit.mediaAuthorityId === target.mediaAuthorityId && audit.hash === target.hash))), mutated: createdAudits.length > 0 };
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

export function evaluateProductMediaReadiness(records: readonly ProductMediaAuthorityRecord[], target?: { stateCode?: string | null }): ProductMediaReadiness {
  const approved = records.filter((record) => record.ownerApproval === "APPROVED");
  const approvedScopes = (record: ProductMediaAuthorityRecord) => record.approvedUsageScopes ?? record.usageScopes;
  const product = approved.filter((record) => record.authorityClass === "PRODUCT_AUTHORITY" && approvedScopes(record).includes("PRODUCT_AUTHORITY") && record.productRepresentationAllowed);
  const contextual = approved.filter((record) => approvedScopes(record).includes("CONTEXTUAL_IN_USE") && record.contextualUseAllowed);
  const application = approved.filter((record) => approvedScopes(record).includes("APPLICATION_EXPERIENCE") && record.applicationUseAllowed);
  const targetStateCode = target?.stateCode?.trim().toUpperCase() || null;
  const local = approved.filter((record) => approvedScopes(record).includes("LOCAL_CONTEXTUAL_ATMOSPHERE") && record.localAtmosphereUseAllowed
    && (targetStateCode ? (record.localAtmosphereStateCodes ?? []).includes(targetStateCode) : (record.localAtmosphereStateCodes ?? []).length > 0));
  const hero = product.find((record) => record.heroSelected && record.heroEligible) ?? null;
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