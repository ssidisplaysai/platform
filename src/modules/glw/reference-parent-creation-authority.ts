import "server-only";

import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";

export const GLW_REFERENCE_PARENT_CREATION_OPERATION = "REFERENCE_PARENT_DRAFT_CREATION" as const;
const PREFLIGHT_SECONDS = 120;
const GRANT_SECONDS = 300;

type Context = {
  operationType: typeof GLW_REFERENCE_PARENT_CREATION_OPERATION;
  principalId: string;
  principalSessionId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  exactRuntime: string;
  title: string;
  slug: string;
  parentId: "0";
  wordpressStatus: "draft";
  inventoryFingerprint: string;
  canonicalProductPath: string;
  authorityClassification: "MISSING_PARENT_REQUIRES_CREATION";
};
export type GlwReferenceParentCreationContext = Context;
type Preflight = Context & { preflightId: string; issuedAt: string; expiresAt: string };
type Grant = Context & { grantId: string; preflightId: string; issuedAt: string; expiresAt: string; status: "ACTIVE" | "CONSUMED"; consumedAt: string | null; consumedClaimId: string | null };
type Claim = Context & { claimId: string; grantId: string; preflightId: string; consumedAt: string };
type State = { preflights: Preflight[]; grants: Grant[]; claims: Claim[] };
const NAMESPACE = "glw-reference-parent-creation-authority";
const FIELDS: ReadonlyArray<keyof Context> = ["operationType", "principalId", "principalSessionId", "organizationId", "siteId", "campaignId", "exactRuntime", "title", "slug", "parentId", "wordpressStatus", "inventoryFingerprint", "canonicalProductPath", "authorityClassification"];

export class GlwReferenceParentCreationAuthorityError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "GlwReferenceParentCreationAuthorityError"; }
}
function load() { return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ preflights: [], grants: [], claims: [] }) }); }
function persist(state: State, revision: number) { savePersistedState({ namespace: NAMESPACE, state, expectedRevision: revision }); }
function expires(now: Date, seconds: number) { return new Date(now.getTime() + seconds * 1000).toISOString(); }
function bind(principal: GlwTrustedOperatorPrincipal, context: Omit<Context, "principalId" | "principalSessionId">): Context { return { ...context, principalId: principal.principalId, principalSessionId: principal.sessionId }; }
function assertContext(context: Context) {
  for (const field of FIELDS) if (!String(context[field] ?? "").trim()) throw new GlwReferenceParentCreationAuthorityError(`${String(field).toUpperCase()}_REQUIRED`, `${String(field)} is required.`);
  if (context.operationType !== GLW_REFERENCE_PARENT_CREATION_OPERATION || context.title !== "Outdoor Digital Sphere" || context.slug !== "outdoor-digital-sphere" || context.parentId !== "0" || context.wordpressStatus !== "draft" || context.canonicalProductPath !== "/outdoor-digital-sphere/" || context.authorityClassification !== "MISSING_PARENT_REQUIRES_CREATION") throw new GlwReferenceParentCreationAuthorityError("PARENT_IDENTITY_INVALID", "Exact parent draft identity is required.");
  if (!/^[0-9a-f]{40}$/.test(context.exactRuntime) || !/^[0-9a-f]{64}$/.test(context.inventoryFingerprint)) throw new GlwReferenceParentCreationAuthorityError("FINGERPRINT_INVALID", "Exact runtime and inventory fingerprints are required.");
}
function assertMatch(expected: Context, actual: Context) { for (const field of FIELDS) if (expected[field] !== actual[field]) throw new GlwReferenceParentCreationAuthorityError(`${String(field).toUpperCase()}_MISMATCH`, `Parent authority mismatch: ${String(field)}.`); }

export function issueGlwReferenceParentCreationPreflight(input: { principal: GlwTrustedOperatorPrincipal; context: Omit<Context, "principalId" | "principalSessionId">; now?: Date }): Preflight {
  const now = input.now ?? new Date(), context = bind(input.principal, input.context); assertContext(context);
  const preflight = { ...context, preflightId: `glw-parent-preflight-${randomUUID()}`, issuedAt: now.toISOString(), expiresAt: expires(now, PREFLIGHT_SECONDS) };
  const current = load(); current.state.preflights.push(preflight); persist(current.state, current.revision); return deepClone(preflight);
}
export function issueGlwReferenceParentCreationGrant(input: { principal: GlwTrustedOperatorPrincipal; preflightId: string; liveContext: Omit<Context, "principalId" | "principalSessionId">; now?: Date }): Grant {
  const now = input.now ?? new Date(), live = bind(input.principal, input.liveContext); assertContext(live); const current = load();
  const preflight = current.state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
  if (!preflight) throw new GlwReferenceParentCreationAuthorityError("PREFLIGHT_NOT_FOUND", "Parent preflight was not found.");
  if (new Date(preflight.expiresAt) <= now) throw new GlwReferenceParentCreationAuthorityError("PREFLIGHT_EXPIRED", "Parent preflight expired.");
  assertMatch(preflight, live);
  const grant = { ...live, grantId: `glw-parent-grant-${randomUUID()}`, preflightId: preflight.preflightId, issuedAt: now.toISOString(), expiresAt: expires(now, GRANT_SECONDS), status: "ACTIVE" as const, consumedAt: null, consumedClaimId: null };
  current.state.grants.push(grant); persist(current.state, current.revision); return deepClone(grant);
}
export function consumeGlwReferenceParentCreationGrant(input: { principal: GlwTrustedOperatorPrincipal; preflightId: string; grantId: string; liveContext: Omit<Context, "principalId" | "principalSessionId">; now?: Date }): Claim {
  const now = input.now ?? new Date(), live = bind(input.principal, input.liveContext); assertContext(live); const current = load();
  const grant = current.state.grants.find((candidate) => candidate.grantId === input.grantId);
  if (!grant || grant.preflightId !== input.preflightId) throw new GlwReferenceParentCreationAuthorityError("GRANT_NOT_FOUND", "Exact parent grant was not found.");
  if (grant.status !== "ACTIVE" || grant.consumedAt) throw new GlwReferenceParentCreationAuthorityError("GRANT_CONSUMED", "Parent grant was already consumed.");
  if (new Date(grant.expiresAt) <= now) throw new GlwReferenceParentCreationAuthorityError("GRANT_EXPIRED", "Parent grant expired.");
  const preflight = current.state.preflights.find((candidate) => candidate.preflightId === input.preflightId);
  if (!preflight) throw new GlwReferenceParentCreationAuthorityError("PREFLIGHT_NOT_FOUND", "Parent preflight was not found.");
  assertMatch(preflight, live); assertMatch(grant, live);
  const claim = { ...live, claimId: `glw-parent-claim-${randomUUID()}`, grantId: grant.grantId, preflightId: preflight.preflightId, consumedAt: now.toISOString() };
  grant.status = "CONSUMED"; grant.consumedAt = claim.consumedAt; grant.consumedClaimId = claim.claimId; current.state.claims.push(claim); persist(current.state, current.revision); return deepClone(claim);
}
