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

const NAMESPACE = "glw-campaign-activation-authorization-v1";
const SCHEMA_VERSION = 1 as const;
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GlwCampaignActivationGrant = {
  grantId: string;
  purpose: "ACTIVATE_ONLY";
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetFingerprint: string;
  publicationPolicy: GlwCampaign["publicationPolicy"];
  certifiedReleaseSha: string;
  expiresAt: string;
  nonce: string;
  createdAt: string;
  createdBy: string;
  claimedAt: string | null;
  claimedBy: string | null;
  claimId: string | null;
  consumedAt: string | null;
  consumedBy: string | null;
};

type State = { schemaVersion: typeof SCHEMA_VERSION; grants: GlwCampaignActivationGrant[] };

function seed(): State { return { schemaVersion: SCHEMA_VERSION, grants: [] }; }
function normalizeRelease(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!EXACT_RELEASE_PATTERN.test(normalized)) throw new Error("ACTIVATION_GRANT_RELEASE_INVALID");
  return normalized;
}
function grantShapeValid(grant: GlwCampaignActivationGrant): boolean {
  const claimedConsistent = grant.claimedAt === null
    ? grant.claimedBy === null && grant.claimId === null
    : Boolean(grant.claimedBy && grant.claimId && Number.isFinite(new Date(grant.claimedAt).getTime()));
  const consumedConsistent = grant.consumedAt === null
    ? grant.consumedBy === null
    : Boolean(grant.consumedBy && grant.claimedAt && Number.isFinite(new Date(grant.consumedAt).getTime()));
  return grant.purpose === "ACTIVATE_ONLY"
    && Boolean(grant.grantId && grant.organizationId && grant.siteId && grant.campaignId && grant.createdBy)
    && FINGERPRINT_PATTERN.test(grant.targetFingerprint)
    && (grant.publicationPolicy === "draft_only" || grant.publicationPolicy === "publish_after_gates")
    && EXACT_RELEASE_PATTERN.test(grant.certifiedReleaseSha)
    && NONCE_PATTERN.test(grant.nonce)
    && Number.isFinite(new Date(grant.createdAt).getTime())
    && Number.isFinite(new Date(grant.expiresAt).getTime())
    && claimedConsistent
    && consumedConsistent;
}
function canonicalTargetIdentities(campaign: GlwCampaign, targets: readonly GlwCampaignTarget[]): readonly string[] {
  if (targets.length === 0) throw new Error("ACTIVATION_GRANT_TARGETS_REQUIRED");
  return targets.map((target) => {
    if (
      target.campaignId !== campaign.campaignId
      || target.organizationId !== campaign.organizationId
      || target.siteId !== campaign.siteId
      || target.productId !== campaign.productId
      || target.pageType !== campaign.pageType
      || !target.applicationPath
      || !target.canonicalPath
    ) throw new Error("ACTIVATION_GRANT_TARGET_IDENTITY_INVALID");
    return [
      target.organizationId,
      target.siteId,
      target.productId,
      target.pageType,
      target.stateCode,
      target.citySlug ?? "",
      target.applicationPath,
      target.canonicalPath,
    ].join("::");
  }).sort();
}

export function createGlwCampaignTargetFingerprint(
  campaign: GlwCampaign,
  targets: readonly GlwCampaignTarget[],
): string {
  return createHash("sha256").update(JSON.stringify({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    pageType: campaign.pageType,
    targets: canonicalTargetIdentities(campaign, targets),
  })).digest("hex");
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
  throw new Error("ACTIVATION_GRANT_CAS_RETRY_EXHAUSTED");
}

export function listGlwCampaignActivationGrants(campaignId: string): readonly GlwCampaignActivationGrant[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.grants
    .filter((grant) => grant.campaignId === campaignId));
}

export function createGlwCampaignActivationGrant(input: {
  campaign: GlwCampaign;
  targets: readonly GlwCampaignTarget[];
  certifiedReleaseSha: string;
  expiresAt: string;
  createdBy: string;
  now?: Date;
  createNonce?: () => string;
}): GlwCampaignActivationGrant {
  const now = input.now ?? new Date();
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now || expiresAt.getTime() - now.getTime() > 60 * 60 * 1000) {
    throw new Error("ACTIVATION_GRANT_EXPIRY_INVALID");
  }
  const nonce = (input.createNonce ?? randomUUID)();
  if (!NONCE_PATTERN.test(nonce)) throw new Error("ACTIVATION_GRANT_NONCE_INVALID");
  const targetFingerprint = createGlwCampaignTargetFingerprint(input.campaign, input.targets);
  const certifiedReleaseSha = normalizeRelease(input.certifiedReleaseSha);
  const createdAt = now.toISOString();
  return saveWithRetry((state) => {
    const active = state.grants.find((grant) =>
      grant.campaignId === input.campaign.campaignId
      && !grant.consumedAt
      && !grant.claimedAt
      && new Date(grant.expiresAt) > now);
    if (active) throw new Error("ACTIVATION_GRANT_ALREADY_EXISTS");
    const grant: GlwCampaignActivationGrant = {
      grantId: `activation-grant-${randomUUID()}`,
      purpose: "ACTIVATE_ONLY",
      organizationId: input.campaign.organizationId,
      siteId: input.campaign.siteId,
      campaignId: input.campaign.campaignId,
      targetFingerprint,
      publicationPolicy: input.campaign.publicationPolicy,
      certifiedReleaseSha,
      expiresAt: expiresAt.toISOString(),
      nonce,
      createdAt,
      createdBy: input.createdBy,
      claimedAt: null,
      claimedBy: null,
      claimId: null,
      consumedAt: null,
      consumedBy: null,
    };
    return { state: { ...state, grants: [...state.grants, grant] }, value: deepClone(grant) };
  });
}

export function claimGlwCampaignActivationGrant(input: {
  campaign: GlwCampaign;
  targets: readonly GlwCampaignTarget[];
  certifiedReleaseSha: string;
  claimedBy: string;
  now?: Date;
}): { grant: GlwCampaignActivationGrant; claimId: string } {
  const now = input.now ?? new Date();
  const release = normalizeRelease(input.certifiedReleaseSha);
  const fingerprint = createGlwCampaignTargetFingerprint(input.campaign, input.targets);
  return saveWithRetry((state) => {
    const grant = [...state.grants].reverse().find((candidate) => candidate.campaignId === input.campaign.campaignId);
    if (!grant || !grantShapeValid(grant)) throw new Error("ACTIVATION_GRANT_INVALID");
    if (grant.organizationId !== input.campaign.organizationId) throw new Error("ACTIVATION_GRANT_ORGANIZATION_MISMATCH");
    if (grant.siteId !== input.campaign.siteId) throw new Error("ACTIVATION_GRANT_SITE_MISMATCH");
    if (grant.campaignId !== input.campaign.campaignId) throw new Error("ACTIVATION_GRANT_CAMPAIGN_MISMATCH");
    if (grant.targetFingerprint !== fingerprint) throw new Error("ACTIVATION_GRANT_TARGET_FINGERPRINT_MISMATCH");
    if (grant.publicationPolicy !== input.campaign.publicationPolicy) throw new Error("ACTIVATION_GRANT_PUBLICATION_POLICY_MISMATCH");
    if (grant.certifiedReleaseSha !== release) throw new Error("ACTIVATION_GRANT_RELEASE_MISMATCH");
    if (new Date(grant.expiresAt) <= now) throw new Error("ACTIVATION_GRANT_EXPIRED");
    if (grant.consumedAt) throw new Error("ACTIVATION_GRANT_CONSUMED");
    if (grant.claimedAt) throw new Error("ACTIVATION_GRANT_ALREADY_CLAIMED");
    const claimId = randomUUID();
    const claimed = { ...grant, claimedAt: now.toISOString(), claimedBy: input.claimedBy, claimId };
    return {
      state: { ...state, grants: state.grants.map((candidate) => candidate.grantId === grant.grantId ? claimed : candidate) },
      value: { grant: deepClone(claimed), claimId },
    };
  });
}

export function consumeGlwCampaignActivationGrant(input: {
  grantId: string;
  claimId: string;
  consumedBy: string;
  now?: Date;
}): GlwCampaignActivationGrant {
  const now = input.now ?? new Date();
  return saveWithRetry((state) => {
    const grant = state.grants.find((candidate) => candidate.grantId === input.grantId);
    if (
      !grant
      || !grantShapeValid(grant)
      || !grant.claimedAt
      || grant.claimId !== input.claimId
      || grant.consumedAt
      || new Date(grant.expiresAt) <= now
    ) {
      throw new Error("ACTIVATION_GRANT_CONSUMPTION_INVALID");
    }
    const consumed = { ...grant, consumedAt: now.toISOString(), consumedBy: input.consumedBy };
    return {
      state: { ...state, grants: state.grants.map((candidate) => candidate.grantId === grant.grantId ? consumed : candidate) },
      value: deepClone(consumed),
    };
  });
}