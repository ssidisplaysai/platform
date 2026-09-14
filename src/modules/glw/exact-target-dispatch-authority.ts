import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";

const NAMESPACE = "glw-exact-target-dispatch-authority-v1";
const SCHEMA_VERSION = 1 as const;
const PREFLIGHT_TTL_MS = 5 * 60 * 1000;
const GRANT_TTL_MS = 2 * 60 * 1000;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export type GlwDispatchPrincipal = {
  principalId: string;
  sessionId: string;
};

export type GlwExactTargetPreflightReceipt = {
  preflightReceiptId: string;
  purpose: "EXACT_TARGET_DISPATCH_PREFLIGHT";
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  targetFingerprint: string;
  operation: "OWNER_EXACT_TARGET_DISPATCH";
  runtimeSha: string;
  principal: GlwDispatchPrincipal;
  releaseAuthorityReady: true;
  wordpressAuthorityReady: true;
  mcpReady: true;
  n8nReady: true;
  concurrencyReady: true;
  dailyAllowanceBefore: number;
  publicationPolicy: GlwCampaign["publicationPolicy"];
  createdAt: string;
  expiresAt: string;
};

export type GlwOwnerExactTargetDispatchGrant = {
  grantId: string;
  purpose: "OWNER_EXACT_TARGET_DISPATCH";
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  targetFingerprint: string;
  operation: "OWNER_EXACT_TARGET_DISPATCH";
  runtimeSha: string;
  preflightReceiptId: string;
  principal: GlwDispatchPrincipal;
  confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET";
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedByRequestReceiptId: string | null;
};

export type GlwDispatchRequestReceipt = {
  requestReceiptId: string;
  timestamp: string;
  route: string;
  method: "POST";
  runtimeSha: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  operation: "OWNER_EXACT_TARGET_DISPATCH";
  principal: GlwDispatchPrincipal;
  confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET";
  preflightReceiptId: string;
  ownerDispatchGrantId: string;
  grantValidationResult: "PASS";
  releaseAuthorityResult: "PENDING" | "PASS" | "FAIL";
  wordpressAuthorityResult: "PENDING" | "PASS" | "FAIL";
  mcpPreflightResult: "PENDING" | "PASS" | "FAIL";
  allowanceBefore: number;
  allowanceAfter: number;
  leaseId: string | null;
  jobId: string | null;
  externalExecutionId: string | null;
  outcome: "AUTHORIZED" | "LEASED" | "DISPATCHED" | "FAILED";
};

type GrantConsumption = {
  grantId: string;
  requestReceiptId: string;
  consumedAt: string;
};

type DispatchOutcome = {
  requestReceiptId: string;
  recordedAt: string;
  patch: Partial<Pick<GlwDispatchRequestReceipt,
    "releaseAuthorityResult" | "wordpressAuthorityResult" | "mcpPreflightResult" |
    "allowanceAfter" | "leaseId" | "jobId" | "externalExecutionId" | "outcome">>;
};

type State = {
  schemaVersion: typeof SCHEMA_VERSION;
  preflights: GlwExactTargetPreflightReceipt[];
  grants: Omit<GlwOwnerExactTargetDispatchGrant, "consumedAt" | "consumedByRequestReceiptId">[];
  consumptions: GrantConsumption[];
  requests: GlwDispatchRequestReceipt[];
  outcomes: DispatchOutcome[];
};

const seed = (): State => ({ schemaVersion: SCHEMA_VERSION, preflights: [], grants: [], consumptions: [], requests: [], outcomes: [] });

function iso(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("DISPATCH_AUTHORITY_TIME_INVALID");
  return value.toISOString();
}

function runtimeSha(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SHA_PATTERN.test(normalized)) throw new Error("DISPATCH_RUNTIME_SHA_INVALID");
  return normalized;
}

function principal(value: GlwDispatchPrincipal): GlwDispatchPrincipal {
  const principalId = value.principalId.trim();
  const sessionId = value.sessionId.trim();
  if (!principalId || !sessionId) throw new Error("DISPATCH_PRINCIPAL_REQUIRED");
  return { principalId, sessionId };
}

function samePrincipal(left: GlwDispatchPrincipal, right: GlwDispatchPrincipal): boolean {
  return left.principalId === right.principalId && left.sessionId === right.sessionId;
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
  throw new Error("DISPATCH_AUTHORITY_CAS_RETRY_EXHAUSTED");
}

function loadState(): State {
  return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state;
}

export function createExactTargetDispatchFingerprint(input: {
  campaign: GlwCampaign;
  target: GlwCampaignTarget;
  runtimeSha: string;
}): string {
  const { campaign, target } = input;
  if (target.campaignId !== campaign.campaignId || target.organizationId !== campaign.organizationId || target.siteId !== campaign.siteId) {
    throw new Error("DISPATCH_TARGET_SCOPE_INVALID");
  }
  return createHash("sha256").update(JSON.stringify({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    targetId: target.targetId,
    targetStatus: target.status,
    targetUpdatedAt: target.updatedAt,
    canonicalPath: target.canonicalPath ?? null,
    wordpressClassification: target.wordpressObjectId ? "BOUND" : "UNBOUND",
    wordpressObjectId: target.wordpressObjectId,
    productId: target.productId,
    publicationPolicy: campaign.publicationPolicy,
    runtimeSha: runtimeSha(input.runtimeSha),
    dispatchEligible: target.status === "queued" && !target.leaseId && !target.jobId && !target.wordpressObjectId,
  })).digest("hex");
}

export function saveExactTargetDispatchPreflight(input: {
  campaign: GlwCampaign;
  target: GlwCampaignTarget;
  runtimeSha: string;
  principal: GlwDispatchPrincipal;
  dailyAllowanceBefore: number;
  readiness: {
    releaseAuthorityReady: boolean;
    wordpressAuthorityReady: boolean;
    mcpReady: boolean;
    n8nReady: boolean;
    concurrencyReady: boolean;
  };
  now?: Date;
}): GlwExactTargetPreflightReceipt {
  if (Object.values(input.readiness).some((ready) => !ready)) throw new Error("DISPATCH_PREFLIGHT_NOT_READY");
  if (input.target.status !== "queued" || input.target.leaseId || input.target.jobId || input.target.wordpressObjectId) throw new Error("DISPATCH_TARGET_NOT_ELIGIBLE");
  if (input.dailyAllowanceBefore < 1) throw new Error("DISPATCH_ALLOWANCE_EXHAUSTED");
  const now = input.now ?? new Date();
  const createdAt = iso(now);
  const receipt: GlwExactTargetPreflightReceipt = {
    preflightReceiptId: `dispatch-preflight-${randomUUID()}`,
    purpose: "EXACT_TARGET_DISPATCH_PREFLIGHT",
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    campaignId: input.campaign.campaignId,
    targetId: input.target.targetId,
    targetFingerprint: createExactTargetDispatchFingerprint(input),
    operation: "OWNER_EXACT_TARGET_DISPATCH",
    runtimeSha: runtimeSha(input.runtimeSha),
    principal: principal(input.principal),
    releaseAuthorityReady: true,
    wordpressAuthorityReady: true,
    mcpReady: true,
    n8nReady: true,
    concurrencyReady: true,
    dailyAllowanceBefore: input.dailyAllowanceBefore,
    publicationPolicy: input.campaign.publicationPolicy,
    createdAt,
    expiresAt: iso(new Date(now.getTime() + PREFLIGHT_TTL_MS)),
  };
  return saveWithRetry((state) => ({ state: { ...state, preflights: [...state.preflights, receipt] }, value: deepClone(receipt) }));
}

export function createOwnerExactTargetDispatchGrant(input: {
  preflightReceiptId: string;
  campaign: GlwCampaign;
  target: GlwCampaignTarget;
  runtimeSha: string;
  principal: GlwDispatchPrincipal;
  confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET";
  now?: Date;
}): GlwOwnerExactTargetDispatchGrant {
  const now = input.now ?? new Date();
  const currentPrincipal = principal(input.principal);
  const state = loadState();
  const preflight = state.preflights.find((candidate) => candidate.preflightReceiptId === input.preflightReceiptId);
  if (!preflight) throw new Error("DISPATCH_PREFLIGHT_NOT_FOUND");
  const latestPreflight = [...state.preflights].reverse().find((candidate) => candidate.organizationId === input.campaign.organizationId && candidate.siteId === input.campaign.siteId && candidate.campaignId === input.campaign.campaignId && candidate.targetId === input.target.targetId);
  if (latestPreflight?.preflightReceiptId !== preflight.preflightReceiptId) throw new Error("DISPATCH_PREFLIGHT_SUPERSEDED");
  if (new Date(preflight.expiresAt) <= now) throw new Error("DISPATCH_PREFLIGHT_EXPIRED");
  if (now <= new Date(preflight.createdAt)) throw new Error("OWNER_DISPATCH_GRANT_MUST_FOLLOW_PREFLIGHT");
  if (preflight.organizationId !== input.campaign.organizationId) throw new Error("DISPATCH_GRANT_ORGANIZATION_MISMATCH");
  if (preflight.siteId !== input.campaign.siteId) throw new Error("DISPATCH_GRANT_SITE_MISMATCH");
  if (preflight.campaignId !== input.campaign.campaignId) throw new Error("DISPATCH_GRANT_CAMPAIGN_MISMATCH");
  if (preflight.targetId !== input.target.targetId) throw new Error("DISPATCH_GRANT_TARGET_MISMATCH");
  if (preflight.runtimeSha !== runtimeSha(input.runtimeSha)) throw new Error("DISPATCH_GRANT_RUNTIME_MISMATCH");
  if (!samePrincipal(preflight.principal, currentPrincipal)) throw new Error("DISPATCH_GRANT_PRINCIPAL_MISMATCH");
  const fingerprint = createExactTargetDispatchFingerprint(input);
  if (preflight.targetFingerprint !== fingerprint) throw new Error("DISPATCH_PREFLIGHT_STALE");
  const createdAt = iso(now);
  const immutableGrant = {
    grantId: `owner-dispatch-grant-${randomUUID()}`,
    purpose: "OWNER_EXACT_TARGET_DISPATCH" as const,
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    campaignId: input.campaign.campaignId,
    targetId: input.target.targetId,
    targetFingerprint: fingerprint,
    operation: "OWNER_EXACT_TARGET_DISPATCH" as const,
    runtimeSha: runtimeSha(input.runtimeSha),
    preflightReceiptId: preflight.preflightReceiptId,
    principal: currentPrincipal,
    confirmationMode: input.confirmationMode,
    createdAt,
    expiresAt: iso(new Date(now.getTime() + GRANT_TTL_MS)),
  };
  saveWithRetry((current) => ({ state: { ...current, grants: [...current.grants, immutableGrant] }, value: immutableGrant }));
  return { ...immutableGrant, consumedAt: null, consumedByRequestReceiptId: null };
}

export function authorizeExactTargetDispatchRequest(input: {
  preflightReceiptId: string;
  ownerDispatchGrantId: string;
  campaign: GlwCampaign;
  target: GlwCampaignTarget;
  runtimeSha: string;
  principal: GlwDispatchPrincipal;
  confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET";
  route: string;
  allowanceBefore: number;
  now?: Date;
}): { grant: GlwOwnerExactTargetDispatchGrant; requestReceipt: GlwDispatchRequestReceipt } {
  const now = input.now ?? new Date();
  const currentPrincipal = principal(input.principal);
  const currentRuntimeSha = runtimeSha(input.runtimeSha);
  return saveWithRetry((state) => {
    const preflight = state.preflights.find((candidate) => candidate.preflightReceiptId === input.preflightReceiptId);
    if (!preflight) throw new Error("DISPATCH_PREFLIGHT_NOT_FOUND");
    if (new Date(preflight.expiresAt) <= now) throw new Error("DISPATCH_PREFLIGHT_EXPIRED");
    const immutableGrant = state.grants.find((candidate) => candidate.grantId === input.ownerDispatchGrantId);
    if (!immutableGrant) throw new Error("OWNER_DISPATCH_GRANT_NOT_FOUND");
    if (state.consumptions.some((entry) => entry.grantId === immutableGrant.grantId)) throw new Error("OWNER_DISPATCH_GRANT_CONSUMED");
    if (new Date(immutableGrant.expiresAt) <= now) throw new Error("OWNER_DISPATCH_GRANT_EXPIRED");
    if (immutableGrant.preflightReceiptId !== preflight.preflightReceiptId) throw new Error("OWNER_DISPATCH_GRANT_PREFLIGHT_MISMATCH");
    if (new Date(immutableGrant.createdAt) <= new Date(preflight.createdAt)) throw new Error("OWNER_DISPATCH_GRANT_PREDATES_PREFLIGHT");
    if (immutableGrant.organizationId !== input.campaign.organizationId || preflight.organizationId !== input.campaign.organizationId) throw new Error("OWNER_DISPATCH_GRANT_ORGANIZATION_MISMATCH");
    if (immutableGrant.siteId !== input.campaign.siteId || preflight.siteId !== input.campaign.siteId) throw new Error("OWNER_DISPATCH_GRANT_SITE_MISMATCH");
    if (immutableGrant.campaignId !== input.campaign.campaignId || preflight.campaignId !== input.campaign.campaignId) throw new Error("OWNER_DISPATCH_GRANT_CAMPAIGN_MISMATCH");
    if (immutableGrant.targetId !== input.target.targetId || preflight.targetId !== input.target.targetId) throw new Error("OWNER_DISPATCH_GRANT_TARGET_MISMATCH");
    if (input.target.organizationId !== input.campaign.organizationId || input.target.siteId !== input.campaign.siteId || input.target.campaignId !== input.campaign.campaignId) throw new Error("OWNER_DISPATCH_GRANT_TARGET_SCOPE_MISMATCH");
    const latestPreflight = [...state.preflights].reverse().find((candidate) => candidate.organizationId === input.campaign.organizationId && candidate.siteId === input.campaign.siteId && candidate.campaignId === input.campaign.campaignId && candidate.targetId === input.target.targetId);
    if (latestPreflight?.preflightReceiptId !== preflight.preflightReceiptId) throw new Error("DISPATCH_PREFLIGHT_SUPERSEDED");
    if (immutableGrant.operation !== "OWNER_EXACT_TARGET_DISPATCH" || preflight.operation !== immutableGrant.operation) throw new Error("OWNER_DISPATCH_GRANT_OPERATION_MISMATCH");
    if (immutableGrant.runtimeSha !== currentRuntimeSha || preflight.runtimeSha !== currentRuntimeSha) throw new Error("OWNER_DISPATCH_GRANT_RUNTIME_MISMATCH");
    const currentFingerprint = createExactTargetDispatchFingerprint(input);
    if (immutableGrant.targetFingerprint !== currentFingerprint || preflight.targetFingerprint !== currentFingerprint) throw new Error("OWNER_DISPATCH_GRANT_FINGERPRINT_STALE");
    if (!samePrincipal(immutableGrant.principal, currentPrincipal) || !samePrincipal(preflight.principal, currentPrincipal)) throw new Error("OWNER_DISPATCH_GRANT_PRINCIPAL_MISMATCH");
    if (immutableGrant.confirmationMode !== input.confirmationMode) throw new Error("OWNER_DISPATCH_GRANT_CONFIRMATION_MISMATCH");
    const timestamp = iso(now);
    const requestReceipt: GlwDispatchRequestReceipt = {
      requestReceiptId: `dispatch-request-${randomUUID()}`,
      timestamp,
      route: input.route,
      method: "POST",
      runtimeSha: currentRuntimeSha,
      organizationId: input.campaign.organizationId,
      siteId: input.campaign.siteId,
      campaignId: input.campaign.campaignId,
      targetId: input.target.targetId,
      operation: "OWNER_EXACT_TARGET_DISPATCH",
      principal: currentPrincipal,
      confirmationMode: input.confirmationMode,
      preflightReceiptId: preflight.preflightReceiptId,
      ownerDispatchGrantId: immutableGrant.grantId,
      grantValidationResult: "PASS",
      releaseAuthorityResult: "PENDING",
      wordpressAuthorityResult: "PENDING",
      mcpPreflightResult: "PENDING",
      allowanceBefore: input.allowanceBefore,
      allowanceAfter: input.allowanceBefore,
      leaseId: null,
      jobId: null,
      externalExecutionId: null,
      outcome: "AUTHORIZED",
    };
    const consumption = { grantId: immutableGrant.grantId, requestReceiptId: requestReceipt.requestReceiptId, consumedAt: timestamp };
    const grant = { ...immutableGrant, consumedAt: timestamp, consumedByRequestReceiptId: requestReceipt.requestReceiptId };
    return {
      state: { ...state, consumptions: [...state.consumptions, consumption], requests: [...state.requests, requestReceipt] },
      value: { grant: deepClone(grant), requestReceipt: deepClone(requestReceipt) },
    };
  });
}

export function appendDispatchRequestOutcome(input: {
  requestReceiptId: string;
  patch: DispatchOutcome["patch"];
  now?: Date;
}): GlwDispatchRequestReceipt {
  const now = input.now ?? new Date();
  return saveWithRetry((state) => {
    const base = state.requests.find((receipt) => receipt.requestReceiptId === input.requestReceiptId);
    if (!base) throw new Error("DISPATCH_REQUEST_RECEIPT_NOT_FOUND");
    const outcome = { requestReceiptId: input.requestReceiptId, recordedAt: iso(now), patch: deepClone(input.patch) };
    const prior = state.outcomes.filter((entry) => entry.requestReceiptId === input.requestReceiptId);
    const resolved = [...prior, outcome].reduce((receipt, entry) => ({ ...receipt, ...entry.patch }), base);
    return { state: { ...state, outcomes: [...state.outcomes, outcome] }, value: deepClone(resolved) };
  });
}

export function listDispatchRequestReceipts(): readonly GlwDispatchRequestReceipt[] {
  const state = loadState();
  return state.requests.map((base) => state.outcomes.filter((entry) => entry.requestReceiptId === base.requestReceiptId).reduce((receipt, entry) => ({ ...receipt, ...entry.patch }), deepClone(base)));
}
