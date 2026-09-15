import "server-only";

import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";

export const GLW_REFERENCE_DRAFT_PERSISTENCE_AUTHORITY_VERSION =
  "GLW_REFERENCE_DRAFT_PERSISTENCE_AUTHORITY_V1" as const;
export const GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION = "REFERENCE_DRAFT_PERSISTENCE" as const;
export const GLW_REFERENCE_DRAFT_PERSISTENCE_PREFLIGHT_SECONDS = 120;
export const GLW_REFERENCE_DRAFT_PERSISTENCE_GRANT_SECONDS = 300;

export type GlwReferenceDraftPersistenceContext = {
  operationType: typeof GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION;
  principalId: string;
  principalSessionId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceState: string;
  generationJobId: string;
  n8nExecutionId: string;
  rawArtifactSha256: string;
  canonicalizedArtifactSha256: string;
  canonicalizationReceiptId: string;
  canonicalizationPolicyVersion: string;
  canonicalizationPolicyFingerprint: string;
  generatorContractFingerprint: string;
  qaPolicyFingerprint: string;
  qaFingerprint: string;
  localizationPolicyFingerprint: string;
  wordpressReadAuthorityFingerprint: string;
  wordpressInventoryFingerprint: string;
  canonicalPath: string;
  parentId: string;
  parentSlug: string;
  parentStatus: "draft";
  exactRuntime: string;
};

export type GlwReferenceDraftPersistencePreflight = GlwReferenceDraftPersistenceContext & {
  preflightId: string;
  issuedAt: string;
  expiresAt: string;
};

export type GlwReferenceDraftPersistenceGrant = GlwReferenceDraftPersistenceContext & {
  grantId: string;
  preflightId: string;
  issuedAt: string;
  expiresAt: string;
  status: "ACTIVE" | "CONSUMED";
  consumedAt: string | null;
  consumedClaimId: string | null;
};

export type GlwReferenceDraftPersistenceClaim = GlwReferenceDraftPersistenceContext & {
  claimId: string;
  grantId: string;
  preflightId: string;
  consumedAt: string;
};

type State = {
  preflights: GlwReferenceDraftPersistencePreflight[];
  grants: GlwReferenceDraftPersistenceGrant[];
  claims: GlwReferenceDraftPersistenceClaim[];
};

const NAMESPACE = "glw-reference-draft-persistence-authority";
const FIELDS: ReadonlyArray<keyof GlwReferenceDraftPersistenceContext> = [
  "operationType", "principalId", "principalSessionId", "organizationId", "siteId", "campaignId",
  "referenceState", "generationJobId", "n8nExecutionId", "rawArtifactSha256", "canonicalizedArtifactSha256",
  "canonicalizationReceiptId", "canonicalizationPolicyVersion", "canonicalizationPolicyFingerprint",
  "generatorContractFingerprint", "qaPolicyFingerprint", "qaFingerprint", "localizationPolicyFingerprint",
  "wordpressReadAuthorityFingerprint", "wordpressInventoryFingerprint", "canonicalPath",
  "parentId", "parentSlug", "parentStatus", "exactRuntime",
];

export class GlwReferenceDraftPersistenceAuthorityError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "GlwReferenceDraftPersistenceAuthorityError";
  }
}

function load() {
  return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ preflights: [], grants: [], claims: [] }) });
}

function persist(state: State, revision: number): void {
  savePersistedState({ namespace: NAMESPACE, state, expectedRevision: revision });
}

function bindPrincipal(principal: GlwTrustedOperatorPrincipal, context: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId">): GlwReferenceDraftPersistenceContext {
  return { ...context, principalId: principal.principalId, principalSessionId: principal.sessionId };
}

function assertContext(context: GlwReferenceDraftPersistenceContext): void {
  for (const field of FIELDS) {
    if (!String(context[field] ?? "").trim()) throw new GlwReferenceDraftPersistenceAuthorityError(`${String(field).toUpperCase()}_REQUIRED`, `${String(field)} is required.`);
  }
  if (context.operationType !== GLW_REFERENCE_DRAFT_PERSISTENCE_OPERATION) throw new GlwReferenceDraftPersistenceAuthorityError("OPERATION_INVALID", "Draft persistence authority requires the exact operation.");
  if (!/^[A-Z]{2}$/.test(context.referenceState)) throw new GlwReferenceDraftPersistenceAuthorityError("STATE_INVALID", "An exact state code is required.");
  for (const field of ["rawArtifactSha256", "canonicalizedArtifactSha256", "canonicalizationPolicyFingerprint", "generatorContractFingerprint", "qaPolicyFingerprint", "qaFingerprint", "localizationPolicyFingerprint", "wordpressReadAuthorityFingerprint", "wordpressInventoryFingerprint"] as const) {
    if (!/^[0-9a-f]{64}$/.test(context[field])) throw new GlwReferenceDraftPersistenceAuthorityError(`${field.toUpperCase()}_INVALID`, `${field} must be an exact SHA-256 fingerprint.`);
  }
  if (!/^[0-9a-f]{40}$/.test(context.exactRuntime)) throw new GlwReferenceDraftPersistenceAuthorityError("RUNTIME_INVALID", "Runtime must be an exact Git SHA.");
  if (!/^[1-9]\d*$/.test(context.parentId)) throw new GlwReferenceDraftPersistenceAuthorityError("PARENT_ID_INVALID", "An exact WordPress parent ID is required.");
  if (!context.parentSlug || context.parentStatus !== "draft") throw new GlwReferenceDraftPersistenceAuthorityError("PARENT_IDENTITY_INVALID", "Exact parent slug and draft status are required.");
}

function assertMatch(expected: GlwReferenceDraftPersistenceContext, actual: GlwReferenceDraftPersistenceContext): void {
  for (const field of FIELDS) {
    if (expected[field] !== actual[field]) throw new GlwReferenceDraftPersistenceAuthorityError(`${String(field).toUpperCase()}_MISMATCH`, `Draft persistence authority mismatch: ${String(field)}.`);
  }
}

function expires(now: Date, seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export function issueGlwReferenceDraftPersistencePreflight(input: {
  principal: GlwTrustedOperatorPrincipal;
  context: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceDraftPersistencePreflight {
  const now = input.now ?? new Date();
  const context = bindPrincipal(input.principal, input.context);
  assertContext(context);
  const preflight = { ...context, preflightId: `glw-draft-preflight-${randomUUID()}`, issuedAt: now.toISOString(), expiresAt: expires(now, GLW_REFERENCE_DRAFT_PERSISTENCE_PREFLIGHT_SECONDS) };
  const current = load();
  current.state.preflights.push(preflight);
  persist(current.state, current.revision);
  return deepClone(preflight);
}

export function issueGlwReferenceDraftPersistenceGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  preflightId: string;
  liveContext: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceDraftPersistenceGrant {
  const now = input.now ?? new Date();
  const live = bindPrincipal(input.principal, input.liveContext);
  assertContext(live);
  const current = load();
  const preflight = current.state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
  if (!preflight) throw new GlwReferenceDraftPersistenceAuthorityError("PREFLIGHT_NOT_FOUND", "Draft persistence preflight was not found.");
  if (new Date(preflight.expiresAt) <= now) throw new GlwReferenceDraftPersistenceAuthorityError("PREFLIGHT_EXPIRED", "Draft persistence preflight expired.");
  assertMatch(preflight, live);
  const grant = { ...live, grantId: `glw-draft-grant-${randomUUID()}`, preflightId: preflight.preflightId, issuedAt: now.toISOString(), expiresAt: expires(now, GLW_REFERENCE_DRAFT_PERSISTENCE_GRANT_SECONDS), status: "ACTIVE" as const, consumedAt: null, consumedClaimId: null };
  current.state.grants.push(grant);
  persist(current.state, current.revision);
  return deepClone(grant);
}

export function consumeGlwReferenceDraftPersistenceGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  preflightId: string;
  grantId: string;
  liveContext: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId">;
  now?: Date;
}): GlwReferenceDraftPersistenceClaim {
  const now = input.now ?? new Date();
  const live = bindPrincipal(input.principal, input.liveContext);
  assertContext(live);
  const current = load();
  const grant = current.state.grants.find((candidate) => candidate.grantId === input.grantId);
  if (!grant) throw new GlwReferenceDraftPersistenceAuthorityError("GRANT_NOT_FOUND", "Draft persistence grant was not found.");
  if (grant.preflightId !== input.preflightId) throw new GlwReferenceDraftPersistenceAuthorityError("PREFLIGHT_GRANT_MISMATCH", "Preflight does not match the draft persistence grant.");
  if (grant.status !== "ACTIVE" || grant.consumedAt) throw new GlwReferenceDraftPersistenceAuthorityError("GRANT_CONSUMED", "Draft persistence grant was already consumed.");
  if (new Date(grant.expiresAt) <= now) throw new GlwReferenceDraftPersistenceAuthorityError("GRANT_EXPIRED", "Draft persistence grant expired.");
  const preflight = current.state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
  if (!preflight) throw new GlwReferenceDraftPersistenceAuthorityError("PREFLIGHT_NOT_FOUND", "Draft persistence preflight was not found.");
  assertMatch(preflight, live);
  assertMatch(grant, live);
  const claim = { ...live, claimId: `glw-draft-claim-${randomUUID()}`, grantId: grant.grantId, preflightId: preflight.preflightId, consumedAt: now.toISOString() };
  grant.status = "CONSUMED";
  grant.consumedAt = claim.consumedAt;
  grant.consumedClaimId = claim.claimId;
  current.state.claims.push(claim);
  persist(current.state, current.revision);
  return deepClone(claim);
}

export function projectGlwReferenceDraftPersistenceGrant(input: {
  principal: GlwTrustedOperatorPrincipal;
  liveContext: Omit<GlwReferenceDraftPersistenceContext, "principalId" | "principalSessionId">;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const live = bindPrincipal(input.principal, input.liveContext);
  assertContext(live);
  const grant = load().state.grants.filter((candidate) => FIELDS.every((field) => candidate[field] === live[field])).sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0];
  if (!grant) return null;
  return { grantId: grant.grantId, preflightId: grant.preflightId, issuedAt: grant.issuedAt, expiresAt: grant.expiresAt, status: grant.status === "ACTIVE" && new Date(grant.expiresAt) <= now ? "EXPIRED" as const : grant.status, valid: grant.status === "ACTIVE" && new Date(grant.expiresAt) > now };
}
