import "server-only";

import { createHash } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const NAMESPACE = "glw-release-capability-authority-v1";
const SCHEMA_VERSION = 1 as const;
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

export type GlwReleaseCapabilityOperation =
  | "GLW_CAMPAIGN_ACTIVATION"
  | "GLW_WORDPRESS_PUBLICATION";

export type GlwReleaseCapability = {
  capabilityId: string;
  scope: "ORGANIZATION_SITE";
  organizationId: string;
  siteId: string;
  releaseSha: string;
  allowedOperations: readonly GlwReleaseCapabilityOperation[];
  status: "ENABLED";
  enabledAt: string;
  enabledBy: string;
};

export type GlwCampaignActivationReleaseCapabilityState = {
  status: "MISSING" | "WRONG_RELEASE" | "OPERATION_NOT_ENABLED" | "READY";
  ready: boolean;
  reason: string | null;
  capability: GlwReleaseCapability | null;
};

type State = { schemaVersion: typeof SCHEMA_VERSION; capabilities: GlwReleaseCapability[] };
const seed = (): State => ({ schemaVersion: SCHEMA_VERSION, capabilities: [] });

function normalizedSha(value: string): string {
  const releaseSha = value.trim().toLowerCase();
  if (!EXACT_RELEASE_PATTERN.test(releaseSha)) throw new Error("RELEASE_CAPABILITY_SHA_INVALID");
  return releaseSha;
}

function capabilityId(input: { organizationId: string; siteId: string; releaseSha: string }): string {
  return `release-capability-${createHash("sha256").update(JSON.stringify({
    scope: "ORGANIZATION_SITE",
    organizationId: input.organizationId,
    siteId: input.siteId,
    releaseSha: input.releaseSha,
    operation: "GLW_CAMPAIGN_ACTIVATION",
  })).digest("hex")}`;
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
  throw new Error("RELEASE_CAPABILITY_CAS_RETRY_EXHAUSTED");
}

export function listGlwReleaseCapabilities(): readonly GlwReleaseCapability[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.capabilities);
}

export function enableGlwCampaignActivationReleaseCapability(input: {
  organizationId: string;
  siteId: string;
  releaseSha: string;
  enabledBy: string;
}): GlwReleaseCapability {
  const organizationId = input.organizationId.trim();
  const siteId = input.siteId.trim();
  const releaseSha = normalizedSha(input.releaseSha);
  if (!organizationId || !siteId || !input.enabledBy.trim()) throw new Error("RELEASE_CAPABILITY_SCOPE_INVALID");
  const id = capabilityId({ organizationId, siteId, releaseSha });
  return saveWithRetry((state) => {
    const existing = state.capabilities.find((candidate) => candidate.capabilityId === id);
    if (existing) return { state, value: deepClone(existing) };
    const capability: GlwReleaseCapability = {
      capabilityId: id,
      scope: "ORGANIZATION_SITE",
      organizationId,
      siteId,
      releaseSha,
      allowedOperations: ["GLW_CAMPAIGN_ACTIVATION"],
      status: "ENABLED",
      enabledAt: new Date().toISOString(),
      enabledBy: input.enabledBy.trim(),
    };
    return { state: { ...state, capabilities: [...state.capabilities, capability] }, value: deepClone(capability) };
  });
}

export function resolveGlwCampaignActivationReleaseCapability(input: {
  organizationId: string;
  siteId: string;
  runningReleaseSha: string;
}): GlwCampaignActivationReleaseCapabilityState {
  const runningReleaseSha = input.runningReleaseSha.trim().toLowerCase();
  if (!EXACT_RELEASE_PATTERN.test(runningReleaseSha)) {
    return { status: "MISSING", ready: false, reason: "Exact running release identity is required.", capability: null };
  }
  const scoped = listGlwReleaseCapabilities().filter((candidate) =>
    candidate.scope === "ORGANIZATION_SITE"
    && candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId
    && candidate.status === "ENABLED");
  const exact = [...scoped].reverse().find((candidate) => candidate.releaseSha === runningReleaseSha) ?? null;
  if (!exact) {
    return scoped.length
      ? { status: "WRONG_RELEASE", ready: false, reason: "Release capability exists only for a different software release.", capability: scoped.at(-1) ?? null }
      : { status: "MISSING", ready: false, reason: "GLW campaign activation release capability is not enabled for this organization and site.", capability: null };
  }
  if (!exact.allowedOperations.includes("GLW_CAMPAIGN_ACTIVATION")) {
    return { status: "OPERATION_NOT_ENABLED", ready: false, reason: "Release capability does not permit GLW campaign activation.", capability: exact };
  }
  return { status: "READY", ready: true, reason: null, capability: exact };
}

export function requireGlwCampaignActivationReleaseCapability(input: {
  organizationId: string;
  siteId: string;
  runningReleaseSha: string;
}): GlwReleaseCapability {
  const resolved = resolveGlwCampaignActivationReleaseCapability(input);
  if (!resolved.ready || !resolved.capability) {
    throw new Error(`GLW_CAMPAIGN_ACTIVATION_RELEASE_CAPABILITY_${resolved.status}`);
  }
  return resolved.capability;
}

