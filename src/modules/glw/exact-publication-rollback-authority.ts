import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";

export const GLW_EXACT_PUBLICATION_ROLLBACK_AUTHORITY_VERSION = "GLW_EXACT_PUBLICATION_ROLLBACK_AUTHORITY_V1" as const;
export const EXACT_WORDPRESS_PUBLICATION = "EXACT_WORDPRESS_PUBLICATION" as const;
export const EXACT_WORDPRESS_ROLLBACK = "EXACT_WORDPRESS_ROLLBACK" as const;
export const EXACT_PUBLICATION_PREFLIGHT_SECONDS = 120;
export const EXACT_PUBLICATION_GRANT_SECONDS = 300;

export type ExactWordPressOperation = typeof EXACT_WORDPRESS_PUBLICATION | typeof EXACT_WORDPRESS_ROLLBACK;
export type ExactPublicationRollbackContext = {
  operation: ExactWordPressOperation;
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  targetId: string;
  stateCode: string;
  wordpressObjectId: string;
  parentObjectId: string;
  slug: string;
  canonicalPath: string;
  expectedH1: string;
  storedPostContentSha: string;
  visualCertificationId: string;
  runtimeSha: string;
  expectedCurrentStatus: "draft" | "publish";
  intendedStatus: "publish" | "draft";
  sourcePublicationReceiptId: string | null;
};

type BoundContext = ExactPublicationRollbackContext & { principalId: string; principalSessionId: string; contextFingerprint: string };
export type ExactPublicationRollbackPreflight = BoundContext & { preflightId: string; issuedAt: string; expiresAt: string };
export type ExactPublicationRollbackGrant = BoundContext & { grantId: string; preflightId: string; issuedAt: string; expiresAt: string; consumedAt: string | null; consumedClaimId: string | null; status: "ACTIVE" | "CONSUMED" };
export type ExactPublicationRollbackClaim = BoundContext & { claimId: string; grantId: string; preflightId: string; consumedAt: string };
export type ExactPublicationRollbackReceipt = BoundContext & { receiptId: string; claimId: string; beforeStatus: "draft" | "publish"; afterStatus: "publish" | "draft"; beforeContentSha: string; afterContentSha: string; publicCanonicalHttpStatus: number | null; publicCertificationId: string | null; lifecycleState: "PUBLICATION_MUTATED_AWAITING_CERTIFICATION" | "PUBLIC_CERTIFIED" | "ROLLED_BACK" | "PUBLIC_CERTIFICATION_FAILED"; mutationPerformed: true; recordedAt: string };

type State = {
  preflights: ExactPublicationRollbackPreflight[];
  grants: Omit<ExactPublicationRollbackGrant, "consumedAt" | "consumedClaimId" | "status">[];
  consumptions: Array<{ grantId: string; claimId: string; consumedAt: string }>;
  claims: ExactPublicationRollbackClaim[];
  receipts: ExactPublicationRollbackReceipt[];
};

const NAMESPACE = "glw-exact-publication-rollback-authority-v1";
const seed = (): State => ({ preflights: [], grants: [], consumptions: [], claims: [], receipts: [] });
const REQUIRED_FIELDS: ReadonlyArray<keyof ExactPublicationRollbackContext> = ["operation", "organizationId", "siteId", "campaignId", "productId", "targetId", "stateCode", "wordpressObjectId", "parentObjectId", "slug", "canonicalPath", "expectedH1", "storedPostContentSha", "visualCertificationId", "runtimeSha", "expectedCurrentStatus", "intendedStatus"];

function timestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("EXACT_OPERATION_TIME_INVALID");
  return value.toISOString();
}

function normalizedContext(context: ExactPublicationRollbackContext): ExactPublicationRollbackContext {
  const normalized = Object.fromEntries(Object.entries(context).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as ExactPublicationRollbackContext;
  for (const field of REQUIRED_FIELDS) if (!String(normalized[field] ?? "").trim()) throw new Error(`EXACT_OPERATION_${String(field).toUpperCase()}_REQUIRED`);
  normalized.stateCode = normalized.stateCode.toUpperCase();
  normalized.runtimeSha = normalized.runtimeSha.toLowerCase();
  normalized.storedPostContentSha = normalized.storedPostContentSha.toLowerCase();
  if (!/^[A-Z]{2}$/.test(normalized.stateCode)) throw new Error("EXACT_OPERATION_STATE_INVALID");
  if (!/^[1-9]\d*$/.test(normalized.wordpressObjectId) || !/^[1-9]\d*$/.test(normalized.parentObjectId)) throw new Error("EXACT_OPERATION_WORDPRESS_IDENTITY_INVALID");
  if (!/^[0-9a-f]{64}$/.test(normalized.storedPostContentSha)) throw new Error("EXACT_OPERATION_CONTENT_SHA_INVALID");
  if (!/^[0-9a-f]{40}$/.test(normalized.runtimeSha)) throw new Error("EXACT_OPERATION_RUNTIME_INVALID");
  if (!normalized.canonicalPath.startsWith("/") || !normalized.canonicalPath.endsWith("/") || normalized.canonicalPath !== `/${normalized.canonicalPath.split("/").filter(Boolean).join("/")}/`) throw new Error("EXACT_OPERATION_CANONICAL_PATH_INVALID");
  if (normalized.operation === EXACT_WORDPRESS_PUBLICATION) {
    if (normalized.expectedCurrentStatus !== "draft" || normalized.intendedStatus !== "publish" || normalized.sourcePublicationReceiptId) throw new Error("EXACT_PUBLICATION_TRANSITION_INVALID");
  } else if (normalized.operation === EXACT_WORDPRESS_ROLLBACK) {
    if (normalized.expectedCurrentStatus !== "publish" || normalized.intendedStatus !== "draft" || !normalized.sourcePublicationReceiptId?.trim()) throw new Error("EXACT_ROLLBACK_TRANSITION_INVALID");
  } else throw new Error("EXACT_OPERATION_INVALID");
  return normalized;
}

export function fingerprintExactPublicationRollbackContext(context: ExactPublicationRollbackContext): string {
  return createHash("sha256").update(JSON.stringify(normalizedContext(context))).digest("hex");
}

function bind(input: { context: ExactPublicationRollbackContext; principal: GlwTrustedOperatorPrincipal }): BoundContext {
  const context = normalizedContext(input.context);
  const principalId = input.principal.principalId.trim();
  const principalSessionId = input.principal.sessionId.trim();
  if (!principalId || !principalSessionId) throw new Error("EXACT_OPERATION_AUTHENTICATED_PRINCIPAL_REQUIRED");
  return { ...context, principalId, principalSessionId, contextFingerprint: fingerprintExactPublicationRollbackContext(context) };
}

function same(left: BoundContext, right: BoundContext): boolean {
  return left.contextFingerprint === right.contextFingerprint && left.principalId === right.principalId && left.principalSessionId === right.principalSessionId;
}

function saveWithRetry<T>(mutator: (state: State) => { state: State; value: T }, attempts = 8): T {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
    const result = mutator(deepClone(loaded.state));
    try {
      savePersistedState({ namespace: NAMESPACE, state: result.state, expectedRevision: loaded.revision });
      return result.value;
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === attempts - 1) throw error;
    }
  }
  throw new Error("EXACT_OPERATION_CAS_RETRY_EXHAUSTED");
}

export function issueExactPublicationRollbackPreflight(input: {
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  preflightVerified: true;
  now?: Date;
}): ExactPublicationRollbackPreflight {
  if (input.preflightVerified !== true) throw new Error("EXACT_OPERATION_PREFLIGHT_VERIFICATION_REQUIRED");
  const now = input.now ?? new Date();
  const bound = bind(input);
  const preflight: ExactPublicationRollbackPreflight = { ...bound, preflightId: `exact-operation-preflight-${randomUUID()}`, issuedAt: timestamp(now), expiresAt: timestamp(new Date(now.getTime() + EXACT_PUBLICATION_PREFLIGHT_SECONDS * 1000)) };
  return saveWithRetry((state) => ({ state: { ...state, preflights: [...state.preflights, preflight] }, value: deepClone(preflight) }));
}

export function issueExactPublicationRollbackGrant(input: {
  preflightId: string;
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  now?: Date;
}): ExactPublicationRollbackGrant {
  const now = input.now ?? new Date();
  const bound = bind(input);
  return saveWithRetry((state) => {
    const preflight = state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
    if (!preflight) throw new Error("EXACT_OPERATION_PREFLIGHT_NOT_FOUND");
    const latest = [...state.preflights].reverse().find((candidate) => candidate.organizationId === bound.organizationId && candidate.siteId === bound.siteId && candidate.campaignId === bound.campaignId && candidate.targetId === bound.targetId && candidate.operation === bound.operation);
    if (latest?.preflightId !== preflight.preflightId) throw new Error("EXACT_OPERATION_PREFLIGHT_SUPERSEDED");
    if (new Date(preflight.expiresAt) <= now) throw new Error("EXACT_OPERATION_PREFLIGHT_EXPIRED");
    if (now <= new Date(preflight.issuedAt)) throw new Error("EXACT_OPERATION_GRANT_MUST_FOLLOW_PREFLIGHT");
    if (!same(preflight, bound)) throw new Error("EXACT_OPERATION_PREFLIGHT_CONTEXT_MISMATCH");
    const immutable = { ...bound, grantId: `exact-operation-grant-${randomUUID()}`, preflightId: preflight.preflightId, issuedAt: timestamp(now), expiresAt: timestamp(new Date(now.getTime() + EXACT_PUBLICATION_GRANT_SECONDS * 1000)) };
    return { state: { ...state, grants: [...state.grants, immutable] }, value: { ...deepClone(immutable), consumedAt: null, consumedClaimId: null, status: "ACTIVE" as const } };
  });
}

export function consumeExactPublicationRollbackGrant(input: {
  preflightId: string;
  grantId: string;
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  now?: Date;
}): ExactPublicationRollbackClaim {
  const now = input.now ?? new Date();
  const bound = bind(input);
  return saveWithRetry((state) => {
    const preflight = state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
    const grant = state.grants.find((candidate) => candidate.grantId === input.grantId);
    if (!preflight || !grant || grant.preflightId !== preflight.preflightId) throw new Error("EXACT_OPERATION_GRANT_NOT_FOUND");
    if (state.consumptions.some((item) => item.grantId === grant.grantId)) throw new Error("EXACT_OPERATION_GRANT_CONSUMED");
    if (new Date(grant.expiresAt) <= now) throw new Error("EXACT_OPERATION_GRANT_EXPIRED");
    if (!same(preflight, bound) || !same(grant, bound) || preflight.operation !== grant.operation || grant.operation !== bound.operation) throw new Error("EXACT_OPERATION_GRANT_CONTEXT_MISMATCH");
    const consumedAt = timestamp(now);
    const claim: ExactPublicationRollbackClaim = { ...bound, claimId: `exact-operation-claim-${randomUUID()}`, grantId: grant.grantId, preflightId: preflight.preflightId, consumedAt };
    return { state: { ...state, consumptions: [...state.consumptions, { grantId: grant.grantId, claimId: claim.claimId, consumedAt }], claims: [...state.claims, claim] }, value: deepClone(claim) };
  });
}

export function recordExactPublicationRollbackReceipt(input: Omit<ExactPublicationRollbackReceipt, keyof BoundContext | "receiptId" | "recordedAt"> & {
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  now?: Date;
}): ExactPublicationRollbackReceipt {
  const bound = bind(input);
  if (input.beforeContentSha !== bound.storedPostContentSha || input.afterContentSha !== bound.storedPostContentSha) throw new Error("EXACT_OPERATION_RECEIPT_CONTENT_MISMATCH");
  if (input.beforeStatus !== bound.expectedCurrentStatus || input.afterStatus !== bound.intendedStatus) throw new Error("EXACT_OPERATION_RECEIPT_STATUS_MISMATCH");
  return saveWithRetry((state) => {
    const claim = state.claims.find((candidate) => candidate.claimId === input.claimId);
    if (!claim || !same(claim, bound)) throw new Error("EXACT_OPERATION_CLAIM_NOT_FOUND");
    if (state.receipts.some((receipt) => receipt.claimId === claim.claimId)) throw new Error("EXACT_OPERATION_RECEIPT_ALREADY_RECORDED");
    const receipt: ExactPublicationRollbackReceipt = { ...bound, receiptId: `exact-operation-receipt-${randomUUID()}`, claimId: claim.claimId, beforeStatus: input.beforeStatus, afterStatus: input.afterStatus, beforeContentSha: input.beforeContentSha, afterContentSha: input.afterContentSha, publicCanonicalHttpStatus: input.publicCanonicalHttpStatus, publicCertificationId: input.publicCertificationId, lifecycleState: input.lifecycleState, mutationPerformed: true, recordedAt: timestamp(input.now ?? new Date()) };
    return { state: { ...state, receipts: [...state.receipts, receipt] }, value: deepClone(receipt) };
  });
}

export function listExactPublicationRollbackReceipts(): readonly ExactPublicationRollbackReceipt[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.receipts);
}
