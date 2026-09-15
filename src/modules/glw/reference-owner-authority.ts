import "server-only";

import { randomUUID } from "node:crypto";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";

export const GLW_REFERENCE_OWNER_AUTHORITY_VERSION =
  "GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1";
export const GLW_REFERENCE_PREFLIGHT_LIFETIME_SECONDS = 120;
export const GLW_REFERENCE_GRANT_LIFETIME_SECONDS = 300;

export type GlwReferenceOwnerOperationType =
  | "REFERENCE_GENERATION_INITIAL"
  | "REFERENCE_GENERATION_RETRY";

export type GlwReferenceOwnerContext = {
  operationType: GlwReferenceOwnerOperationType;
  principalId: string;
  principalSessionId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceState: string;
  referenceFingerprint: string;
  campaignInstructionFingerprint: string;
  productAuthorityFingerprint: string;
  qaPolicyVersion: string;
  wordpressReadAuthorityFingerprint: string;
  exactRuntime: string;
  failedJobId: string | null;
  failedArtifactSha256: string | null;
};

export type GlwReferencePreflightReceipt = GlwReferenceOwnerContext & {
  receiptId: string;
  issuedAt: string;
  expiresAt: string;
};

export type GlwReferenceOwnerGrant = GlwReferenceOwnerContext & {
  grantId: string;
  preflightReceiptId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedClaimId: string | null;
  revokedAt: string | null;
  status: "ACTIVE" | "CONSUMED" | "REVOKED";
};

export type GlwReferenceOwnerClaim = GlwReferenceOwnerContext & {
  claimId: string;
  grantId: string;
  preflightReceiptId: string;
  consumedAt: string;
  dispatchValidatedAt: string | null;
};

type State = {
  receipts: GlwReferencePreflightReceipt[];
  grants: GlwReferenceOwnerGrant[];
  claims: GlwReferenceOwnerClaim[];
};

const PERSISTENCE_NAMESPACE = "glw-reference-owner-authority";

export class GlwReferenceOwnerAuthorityError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "GlwReferenceOwnerAuthorityError";
  }
}

function emptyState(): State {
  return { receipts: [], grants: [], claims: [] };
}

function isoAfter(now: Date, seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function assertExactContext(context: GlwReferenceOwnerContext): void {
  const required: Array<[string, string]> = [
    ["PRINCIPAL", context.principalId],
    ["PRINCIPAL_SESSION", context.principalSessionId],
    ["ORGANIZATION", context.organizationId],
    ["SITE", context.siteId],
    ["CAMPAIGN", context.campaignId],
    ["REFERENCE_STATE", context.referenceState],
    ["REFERENCE_FINGERPRINT", context.referenceFingerprint],
    ["INSTRUCTION_FINGERPRINT", context.campaignInstructionFingerprint],
    ["PRODUCT_AUTHORITY_FINGERPRINT", context.productAuthorityFingerprint],
    ["QA_POLICY", context.qaPolicyVersion],
    ["WORDPRESS_AUTHORITY", context.wordpressReadAuthorityFingerprint],
    ["RUNTIME", context.exactRuntime],
  ];
  const missing = required.find(([, value]) => !value.trim());
  if (missing) throw new GlwReferenceOwnerAuthorityError(`${missing[0]}_REQUIRED`, `${missing[0]} is required.`);
  if (!/^[A-Z]{2}$/.test(context.referenceState)) {
    throw new GlwReferenceOwnerAuthorityError("REFERENCE_STATE_INVALID", "Reference state must be an exact two-letter code.");
  }
  if (!/^[0-9a-f]{40}$/.test(context.exactRuntime)) {
    throw new GlwReferenceOwnerAuthorityError("RUNTIME_INVALID", "Exact runtime must be a full Git SHA.");
  }
  if (context.operationType === "REFERENCE_GENERATION_RETRY") {
    if (!context.failedJobId) throw new GlwReferenceOwnerAuthorityError("FAILED_JOB_REQUIRED", "Retry authority requires the exact failed job.");
    if (!context.failedArtifactSha256?.match(/^[0-9a-f]{64}$/)) throw new GlwReferenceOwnerAuthorityError("FAILED_ARTIFACT_REQUIRED", "Retry authority requires the exact failed artifact SHA.");
  } else if (context.failedJobId || context.failedArtifactSha256) {
    throw new GlwReferenceOwnerAuthorityError("INITIAL_RETRY_EVIDENCE_PROHIBITED", "Initial authority cannot carry retry evidence.");
  }
}

function contextFromPrincipal(
  principal: GlwTrustedOperatorPrincipal,
  context: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">,
): GlwReferenceOwnerContext {
  return { ...context, principalId: principal.principalId, principalSessionId: principal.sessionId };
}

const CONTEXT_FIELDS: ReadonlyArray<keyof GlwReferenceOwnerContext> = [
  "operationType", "principalId", "principalSessionId", "organizationId", "siteId",
  "campaignId", "referenceState", "referenceFingerprint",
  "campaignInstructionFingerprint", "productAuthorityFingerprint", "qaPolicyVersion",
  "wordpressReadAuthorityFingerprint", "exactRuntime", "failedJobId", "failedArtifactSha256",
];

const MISMATCH_CODES: Readonly<Record<keyof GlwReferenceOwnerContext, string>> = {
  operationType: "OPERATION_TYPE_MISMATCH",
  principalId: "PRINCIPAL_MISMATCH",
  principalSessionId: "PRINCIPAL_SESSION_MISMATCH",
  organizationId: "ORGANIZATION_MISMATCH",
  siteId: "SITE_MISMATCH",
  campaignId: "CAMPAIGN_MISMATCH",
  referenceState: "REFERENCE_STATE_MISMATCH",
  referenceFingerprint: "REFERENCE_FINGERPRINT_MISMATCH",
  campaignInstructionFingerprint: "INSTRUCTION_FINGERPRINT_MISMATCH",
  productAuthorityFingerprint: "PRODUCT_AUTHORITY_FINGERPRINT_MISMATCH",
  qaPolicyVersion: "QA_POLICY_MISMATCH",
  wordpressReadAuthorityFingerprint: "WORDPRESS_AUTHORITY_MISMATCH",
  exactRuntime: "RUNTIME_MISMATCH",
  failedJobId: "FAILED_JOB_MISMATCH",
  failedArtifactSha256: "FAILED_ARTIFACT_MISMATCH",
};

function assertContextMatch(expected: GlwReferenceOwnerContext, live: GlwReferenceOwnerContext): void {
  for (const field of CONTEXT_FIELDS) {
    if (expected[field] !== live[field]) {
      throw new GlwReferenceOwnerAuthorityError(MISMATCH_CODES[field], `Reference owner authority mismatch: ${field}.`);
    }
  }
}

function load(): { state: State; revision: number } {
  return loadPersistedState<State>({ namespace: PERSISTENCE_NAMESPACE, seedFactory: emptyState });
}

function persist(state: State, revision: number): void {
  savePersistedState({ namespace: PERSISTENCE_NAMESPACE, state, expectedRevision: revision });
}

export type GlwReferenceOwnerGrantProjection = {
  grantId: string;
  preflightReceiptId: string;
  issuedAt: string;
  expiresAt: string;
  status: "ACTIVE" | "CONSUMED" | "REVOKED" | "EXPIRED";
  valid: boolean;
};

export function projectGlwReferenceOwnerGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceOwnerGrantProjection | null {
  const now = input.now ?? new Date();
  const live = contextFromPrincipal(input.principal, input.liveContext);
  assertExactContext(live);
  const grant = load().state.grants
    .filter((candidate) => CONTEXT_FIELDS.every((field) => candidate[field] === live[field]))
    .sort((left, right) => new Date(right.issuedAt).getTime() - new Date(left.issuedAt).getTime())[0];
  if (!grant) return null;
  const expired = new Date(grant.expiresAt) <= now;
  return {
    grantId: grant.grantId,
    preflightReceiptId: grant.preflightReceiptId,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
    status: expired && grant.status === "ACTIVE" ? "EXPIRED" : grant.status,
    valid: grant.status === "ACTIVE" && !expired,
  };
}

export function issueGlwReferencePreflightReceipt(input: {
  principal: GlwTrustedOperatorPrincipal;
  context: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferencePreflightReceipt {
  const now = input.now ?? new Date();
  const context = contextFromPrincipal(input.principal, input.context);
  assertExactContext(context);
  const receipt: GlwReferencePreflightReceipt = {
    ...context,
    receiptId: `glw-ref-preflight-${randomUUID()}`,
    issuedAt: now.toISOString(),
    expiresAt: isoAfter(now, GLW_REFERENCE_PREFLIGHT_LIFETIME_SECONDS),
  };
  const current = load();
  current.state.receipts.push(receipt);
  persist(current.state, current.revision);
  return deepClone(receipt);
}

export function issueGlwReferenceOwnerGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  preflightReceiptId: string;
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceOwnerGrant {
  const now = input.now ?? new Date();
  const live = contextFromPrincipal(input.principal, input.liveContext);
  assertExactContext(live);
  const current = load();
  const receipt = current.state.receipts.find((candidate) => candidate.receiptId === input.preflightReceiptId);
  if (!receipt) throw new GlwReferenceOwnerAuthorityError("PREFLIGHT_NOT_FOUND", "Reference preflight receipt was not found.");
  if (new Date(receipt.expiresAt) <= now) throw new GlwReferenceOwnerAuthorityError("PREFLIGHT_EXPIRED", "Reference preflight receipt expired.");
  assertContextMatch(receipt, live);
  const grant: GlwReferenceOwnerGrant = {
    ...live,
    grantId: `glw-ref-grant-${randomUUID()}`,
    preflightReceiptId: receipt.receiptId,
    issuedAt: now.toISOString(),
    expiresAt: isoAfter(now, GLW_REFERENCE_GRANT_LIFETIME_SECONDS),
    consumedAt: null,
    consumedClaimId: null,
    revokedAt: null,
    status: "ACTIVE",
  };
  current.state.grants.push(grant);
  persist(current.state, current.revision);
  return deepClone(grant);
}

export function consumeGlwReferenceOwnerGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  grantId: string;
  preflightReceiptId: string;
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceOwnerClaim {
  const now = input.now ?? new Date();
  const live = contextFromPrincipal(input.principal, input.liveContext);
  assertExactContext(live);
  const current = load();
  const grant = current.state.grants.find((candidate) => candidate.grantId === input.grantId);
  if (!grant) throw new GlwReferenceOwnerAuthorityError("GRANT_NOT_FOUND", "Reference owner grant was not found.");
  if (grant.preflightReceiptId !== input.preflightReceiptId) throw new GlwReferenceOwnerAuthorityError("PREFLIGHT_GRANT_MISMATCH", "Preflight receipt does not match the grant.");
  if (grant.status === "REVOKED") throw new GlwReferenceOwnerAuthorityError("GRANT_REVOKED", "Reference owner grant was revoked.");
  if (grant.status === "CONSUMED") throw new GlwReferenceOwnerAuthorityError("GRANT_CONSUMED", "Reference owner grant was already consumed.");
  if (new Date(grant.expiresAt) <= now) throw new GlwReferenceOwnerAuthorityError("GRANT_EXPIRED", "Reference owner grant expired.");
  const receipt = current.state.receipts.find((candidate) => candidate.receiptId === input.preflightReceiptId);
  if (!receipt) throw new GlwReferenceOwnerAuthorityError("PREFLIGHT_NOT_FOUND", "Reference preflight receipt was not found.");
  assertContextMatch(receipt, live);
  assertContextMatch(grant, live);
  const claim: GlwReferenceOwnerClaim = {
    ...live,
    claimId: `glw-ref-claim-${randomUUID()}`,
    grantId: grant.grantId,
    preflightReceiptId: receipt.receiptId,
    consumedAt: now.toISOString(),
    dispatchValidatedAt: null,
  };
  grant.status = "CONSUMED";
  grant.consumedAt = claim.consumedAt;
  grant.consumedClaimId = claim.claimId;
  current.state.claims.push(claim);
  persist(current.state, current.revision);
  return deepClone(claim);
}

export function revokeGlwReferenceOwnerGrant(input: { grantId: string; now?: Date }): GlwReferenceOwnerGrant {
  const current = load();
  const grant = current.state.grants.find((candidate) => candidate.grantId === input.grantId);
  if (!grant) throw new GlwReferenceOwnerAuthorityError("GRANT_NOT_FOUND", "Reference owner grant was not found.");
  if (grant.status !== "ACTIVE") throw new GlwReferenceOwnerAuthorityError("GRANT_NOT_ACTIVE", "Only an active grant can be revoked.");
  grant.status = "REVOKED";
  grant.revokedAt = (input.now ?? new Date()).toISOString();
  persist(current.state, current.revision);
  return deepClone(grant);
}

export function validateConsumedGlwReferenceOwnerClaim(input: {
  claimId: string;
  liveContext: GlwReferenceOwnerContext;
}): GlwReferenceOwnerClaim {
  const claim = load().state.claims.find((candidate) => candidate.claimId === input.claimId);
  if (!claim) throw new GlwReferenceOwnerAuthorityError("CLAIM_NOT_FOUND", "Consumed reference owner claim was not found.");
  assertContextMatch(claim, input.liveContext);
  return deepClone(claim);
}

export function validateGlwReferenceOwnerClaimForFailedDispatchRecovery(input: {
  claimId: string;
  job: {
    jobId: string;
    organizationId: string;
    siteId: string;
    state: string | null;
    createdAt: string;
    status: string;
    errorCode: string | null;
    externalExecutionId: string | null;
    generatedDraft: unknown;
    wordpressObjectId: string | null;
  };
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId" | "exactRuntime">;
}): GlwReferenceOwnerClaim {
  const claim = load().state.claims.find((candidate) => candidate.claimId === input.claimId);
  if (!claim) throw new GlwReferenceOwnerAuthorityError("CLAIM_NOT_FOUND", "Consumed reference owner claim was not found.");
  if (!claim.dispatchValidatedAt) throw new GlwReferenceOwnerAuthorityError("CLAIM_DISPATCH_NOT_VALIDATED", "Reference owner claim never crossed the dispatch boundary.");
  if (input.job.status !== "FAILED" || input.job.errorCode !== "DISPATCH_FAILED" || input.job.externalExecutionId || input.job.generatedDraft || input.job.wordpressObjectId) {
    throw new GlwReferenceOwnerAuthorityError("JOB_NOT_RECOVERABLE", "Only a side-effect-free failed dispatch can be recovered.");
  }
  if (claim.organizationId !== input.job.organizationId || claim.siteId !== input.job.siteId || claim.referenceState !== stateCodeForJobState(input.job.state)) {
    throw new GlwReferenceOwnerAuthorityError("JOB_CLAIM_SCOPE_MISMATCH", "Failed job does not match the validated claim scope.");
  }
  const dispatchAt = new Date(claim.dispatchValidatedAt).getTime();
  const createdAt = new Date(input.job.createdAt).getTime();
  if (!Number.isFinite(dispatchAt) || !Number.isFinite(createdAt) || createdAt < dispatchAt || createdAt - dispatchAt > 30_000) {
    throw new GlwReferenceOwnerAuthorityError("JOB_CLAIM_TIME_MISMATCH", "Failed job is not temporally bound to the validated claim.");
  }
  const live = { ...input.liveContext, principalId: claim.principalId, principalSessionId: claim.principalSessionId, exactRuntime: claim.exactRuntime };
  assertExactContext(live);
  assertContextMatch(claim, live);
  return deepClone(claim);
}

export function validateGlwReferenceOwnerClaimForRecoveredContent(input: {
  claimId: string;
  job: {
    organizationId: string;
    siteId: string;
    state: string | null;
    createdAt: string;
    status: string;
    externalExecutionId: string | null;
    generatedDraft: unknown;
    wordpressObjectId: string | null;
  };
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId" | "exactRuntime">;
}): GlwReferenceOwnerClaim {
  const claim = load().state.claims.find((candidate) => candidate.claimId === input.claimId);
  if (!claim) throw new GlwReferenceOwnerAuthorityError("CLAIM_NOT_FOUND", "Consumed reference owner claim was not found.");
  if (!claim.dispatchValidatedAt) throw new GlwReferenceOwnerAuthorityError("CLAIM_DISPATCH_NOT_VALIDATED", "Reference owner claim never crossed the dispatch boundary.");
  if (input.job.status !== "CONTENT_READY" || !input.job.externalExecutionId || !input.job.generatedDraft || input.job.wordpressObjectId) {
    throw new GlwReferenceOwnerAuthorityError("RECOVERED_CONTENT_NOT_FINALIZABLE", "Only recovered content without a WordPress identity can be finalized.");
  }
  if (claim.organizationId !== input.job.organizationId || claim.siteId !== input.job.siteId || claim.referenceState !== stateCodeForJobState(input.job.state)) {
    throw new GlwReferenceOwnerAuthorityError("JOB_CLAIM_SCOPE_MISMATCH", "Recovered content does not match the validated claim scope.");
  }
  const live = { ...input.liveContext, principalId: claim.principalId, principalSessionId: claim.principalSessionId, exactRuntime: claim.exactRuntime };
  assertExactContext(live);
  assertContextMatch(claim, live);
  return deepClone(claim);
}

function stateCodeForJobState(state: string | null): string | null {
  const normalized = state?.trim().toLowerCase() ?? "";
  return GLW_CAMPAIGN_US_STATES.find((candidate) => candidate.name.toLowerCase() === normalized)?.code ?? null;
}

export function consumeGlwReferenceOwnerClaimForDispatch(input: {
  claimId: string;
  liveContext: Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceOwnerClaim {
  const current = load();
  const claim = current.state.claims.find((candidate) => candidate.claimId === input.claimId);
  if (!claim) throw new GlwReferenceOwnerAuthorityError("CLAIM_NOT_FOUND", "Consumed reference owner claim was not found.");
  if (claim.dispatchValidatedAt) throw new GlwReferenceOwnerAuthorityError("CLAIM_REPLAYED", "Reference owner claim was already used at the dispatch boundary.");
  const live: GlwReferenceOwnerContext = {
    ...input.liveContext,
    principalId: claim.principalId,
    principalSessionId: claim.principalSessionId,
  };
  assertExactContext(live);
  assertContextMatch(claim, live);
  claim.dispatchValidatedAt = (input.now ?? new Date()).toISOString();
  persist(current.state, current.revision);
  return deepClone(claim);
}