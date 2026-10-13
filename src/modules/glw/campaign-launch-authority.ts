import "server-only";

import { createHash } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type { GlwCampaign, GlwCampaignPublicationPolicy, NewGlwCampaignInput } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";

const NAMESPACE = "glw-campaign-launch-authority-v1";
const SCHEMA_VERSION = 1 as const;

export type GlwGlobalCityTargetIdentity = {
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "city_service";
  stateCode: string;
  citySlug: string;
  cityName: string;
};

export type GlwGlobalTargetOwnershipState = "RESERVED" | "OWNED" | "UNRECONCILED";
export type GlwCampaignLaunchState =
  | "TARGETS_RESERVED"
  | "REFERENCE_PENDING"
  | "REFERENCE_GENERATION_STARTED"
  | "REFERENCE_REVIEW_REQUIRED"
  | "REFERENCE_APPROVED"
  | "REFERENCE_FAILED_RECOVERABLE"
  | "ACTIVE"
  | "DISPATCH_STARTED"
  | "DISPATCH_RECOVERY_REQUIRED"
  | "COMPENSATED";

export type GlwGlobalTargetOwnership = {
  globalTargetKey: string;
  launchId: string | null;
  campaignId: string | null;
  identity: GlwGlobalCityTargetIdentity;
  state: GlwGlobalTargetOwnershipState;
  targetStatus: string | null;
  reservedAt: string;
  updatedAt: string;
};

export type GlwCampaignLaunchEvent = {
  eventId: string;
  state: GlwCampaignLaunchState;
  recordedAt: string;
  detail: string | null;
};

export type GlwCampaignLaunchRecord = {
  launchId: string;
  idempotencyKey: string;
  campaignId: string | null;
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "city_service";
  publicationPolicy: GlwCampaignPublicationPolicy;
  orderedGlobalTargetKeys: readonly string[];
  referenceTarget: GlwGlobalCityTargetIdentity;
  state: GlwCampaignLaunchState;
  referenceJobId: string | null;
  dispatchState: "NOT_STARTED" | "STARTED" | "RECOVERY_REQUIRED";
  recoveryReason: string | null;
  events: readonly GlwCampaignLaunchEvent[];
  createdAt: string;
  updatedAt: string;
};

type LaunchAuthorityState = {
  schemaVersion: typeof SCHEMA_VERSION;
  ownership: GlwGlobalTargetOwnership[];
  launches: GlwCampaignLaunchRecord[];
};

export type GlwHistoricalOwnershipConflict = {
  globalTargetKey: string;
  campaignIds: readonly string[];
};

export type GlwCampaignLaunchResult = {
  state: "REFERENCE_GENERATION_REQUIRED" | "ALREADY_EXISTS" | "TARGET_CONFLICT" | "HISTORICAL_OWNERSHIP_CONFLICT" | "COMPENSATED" | "RECOVERY_REQUIRED";
  launch: GlwCampaignLaunchRecord | null;
  campaign: GlwCampaign | null;
  conflicts: readonly { globalTargetKey: string; campaignId: string | null; state: GlwGlobalTargetOwnershipState }[];
};

type CampaignCreationResult = { campaign: GlwCampaign | null; errors: readonly string[] };
type LaunchDependencies = {
  listCampaigns: () => readonly GlwCampaign[];
  listTargets: () => readonly GlwCampaignTarget[];
  createCampaign: (input: NewGlwCampaignInput) => CampaignCreationResult;
  createCampaignId: (input: NewGlwCampaignInput) => string;
  afterCampaignCreated?: (campaign: GlwCampaign) => void;
  beforeReservationFinalized?: (campaign: GlwCampaign) => void;
};

function seed(): LaunchAuthorityState {
  return { schemaVersion: SCHEMA_VERSION, ownership: [], launches: [] };
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCitySlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function normalizeGlwGlobalCityTargetIdentity(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: string;
  stateCode: string;
  citySlug: string;
  cityName: string;
}): GlwGlobalCityTargetIdentity {
  const identity: GlwGlobalCityTargetIdentity = {
    organizationId: normalizeId(input.organizationId),
    siteId: normalizeId(input.siteId),
    productId: normalizeId(input.productId),
    pageType: "city_service",
    stateCode: input.stateCode.trim().toUpperCase(),
    citySlug: normalizeCitySlug(input.citySlug),
    cityName: input.cityName.trim(),
  };
  if (input.pageType !== "city_service" || !identity.organizationId || !identity.siteId || !identity.productId || !/^[A-Z]{2}$/.test(identity.stateCode) || !identity.citySlug || !identity.cityName) {
    throw new Error("GLW_CITY_TARGET_IDENTITY_INVALID");
  }
  return identity;
}

export function createGlwGlobalCityTargetKey(identity: GlwGlobalCityTargetIdentity): string {
  return [identity.organizationId, identity.siteId, identity.productId, identity.pageType, identity.stateCode, identity.citySlug].join("::");
}

export function createGlwCampaignLaunchId(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "city_service";
  publicationPolicy: GlwCampaignPublicationPolicy;
  targets: readonly GlwGlobalCityTargetIdentity[];
}): string {
  const orderedKeys = input.targets.map(createGlwGlobalCityTargetKey).sort();
  const canonical = JSON.stringify({
    organizationId: normalizeId(input.organizationId),
    siteId: normalizeId(input.siteId),
    productId: normalizeId(input.productId),
    pageType: input.pageType,
    publicationPolicy: input.publicationPolicy,
    orderedGlobalTargetKeys: orderedKeys,
  });
  return `launch-${createHash("sha256").update(canonical).digest("hex")}`;
}

function materializeExistingOwnership(campaigns: readonly GlwCampaign[], targets: readonly GlwCampaignTarget[]): {
  ownership: GlwGlobalTargetOwnership[];
  conflicts: GlwHistoricalOwnershipConflict[];
} {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const byKey = new Map<string, GlwGlobalTargetOwnership[]>();
  for (const target of targets) {
    const campaign = campaignById.get(target.campaignId);
    if (!campaign || campaign.pageType !== "city_service" || !target.citySlug || !target.cityName) continue;
    const identity = normalizeGlwGlobalCityTargetIdentity({ ...target, pageType: campaign.pageType, citySlug: target.citySlug, cityName: target.cityName });
    const globalTargetKey = createGlwGlobalCityTargetKey(identity);
    const entry: GlwGlobalTargetOwnership = { globalTargetKey, launchId: null, campaignId: campaign.campaignId, identity, state: "OWNED", targetStatus: target.status, reservedAt: target.createdAt, updatedAt: target.updatedAt };
    byKey.set(globalTargetKey, [...(byKey.get(globalTargetKey) ?? []), entry]);
  }
  const conflicts = [...byKey].filter(([, entries]) => new Set(entries.map((entry) => entry.campaignId)).size > 1).map(([globalTargetKey, entries]) => ({ globalTargetKey, campaignIds: [...new Set(entries.map((entry) => entry.campaignId!))].sort() }));
  return { ownership: [...byKey.values()].flat(), conflicts };
}

export function previewGlwGlobalOwnershipReconciliation(input: { campaigns: readonly GlwCampaign[]; targets: readonly GlwCampaignTarget[] }): {
  ownership: readonly GlwGlobalTargetOwnership[];
  conflicts: readonly GlwHistoricalOwnershipConflict[];
} {
  return materializeExistingOwnership(input.campaigns, input.targets);
}

function event(state: GlwCampaignLaunchState, detail: string | null = null): GlwCampaignLaunchEvent {
  const recordedAt = new Date().toISOString();
  return { eventId: `${state.toLowerCase()}-${recordedAt}-${Math.random().toString(36).slice(2, 9)}`, state, recordedAt, detail };
}

function saveWithRetry(mutator: (state: LaunchAuthorityState) => { state: LaunchAuthorityState; value: GlwCampaignLaunchResult; persist?: boolean }, attempts = 8): GlwCampaignLaunchResult {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const loaded = loadPersistedState<LaunchAuthorityState>({ namespace: NAMESPACE, seedFactory: seed });
    const result = mutator(deepClone(loaded.state));
    if (result.persist === false) return result.value;
    try {
      savePersistedState({ namespace: NAMESPACE, state: result.state, expectedRevision: loaded.revision });
      return result.value;
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === attempts - 1) throw error;
    }
  }
  throw new Error("GLW_LAUNCH_CAS_RETRY_EXHAUSTED");
}

function campaignMatchesInput(campaign: GlwCampaign, input: NewGlwCampaignInput): boolean {
  const expectedCities = (input.cityTargets ?? []).map((target) => `${target.stateCode.trim().toUpperCase()}::${normalizeCitySlug(target.citySlug)}`).sort();
  const actualCities = (campaign.cityTargets ?? []).map((target) => `${target.stateCode}::${target.citySlug}`).sort();
  return campaign.organizationId === input.organizationId && campaign.siteId === input.siteId && campaign.productId === input.productId && campaign.pageType === input.pageType && campaign.publicationPolicy === input.publicationPolicy && JSON.stringify(actualCities) === JSON.stringify(expectedCities);
}

function updateLaunchState(launchId: string, nextState: GlwCampaignLaunchState, detail: string | null, patch: Partial<GlwCampaignLaunchRecord> = {}): GlwCampaignLaunchRecord {
  let resolved: GlwCampaignLaunchRecord | null = null;
  saveWithRetry((state) => {
    const launch = state.launches.find((entry) => entry.launchId === launchId);
    if (!launch) throw new Error("GLW_LAUNCH_NOT_FOUND");
    const updated: GlwCampaignLaunchRecord = { ...launch, ...patch, state: nextState, events: [...launch.events, event(nextState, detail)], updatedAt: new Date().toISOString() };
    resolved = updated;
    return { state: { ...state, launches: state.launches.map((entry) => entry.launchId === launchId ? updated : entry) }, value: { state: "ALREADY_EXISTS", launch: updated, campaign: null, conflicts: [] } };
  });
  return resolved!;
}

function finalizeLaunchReservation(launchId: string, campaign: GlwCampaign, detail: string | null = null, recoveryReason: string | null = null): GlwCampaignLaunchRecord {
  let resolved: GlwCampaignLaunchRecord | null = null;
  saveWithRetry((state) => {
    const launch = state.launches.find((entry) => entry.launchId === launchId);
    if (!launch) throw new Error("GLW_LAUNCH_NOT_FOUND");
    const timestamp = new Date().toISOString();
    const updated: GlwCampaignLaunchRecord = { ...launch, campaignId: campaign.campaignId, state: "REFERENCE_PENDING", recoveryReason, events: [...launch.events, event("REFERENCE_PENDING", detail)], updatedAt: timestamp };
    const ownership = state.ownership.map((entry) => entry.launchId === launchId ? { ...entry, campaignId: campaign.campaignId, updatedAt: timestamp } : entry);
    resolved = updated;
    return { state: { ...state, ownership, launches: state.launches.map((entry) => entry.launchId === launchId ? updated : entry) }, value: { state: "ALREADY_EXISTS", launch: updated, campaign, conflicts: [] } };
  });
  return resolved!;
}

export function launchGlwCityCampaign(input: {
  campaignInput: NewGlwCampaignInput;
  authoritativePublicationPolicy: GlwCampaignPublicationPolicy;
  publicationPolicyAcknowledgement?: GlwCampaignPublicationPolicy;
}, dependencies: LaunchDependencies): GlwCampaignLaunchResult {
  if (input.campaignInput.pageType !== "city_service") throw new Error("GLW_LAUNCH_PAGE_TYPE_NOT_SUPPORTED");
  if (input.publicationPolicyAcknowledgement && input.publicationPolicyAcknowledgement !== input.authoritativePublicationPolicy) throw new Error("GLW_LAUNCH_PUBLICATION_POLICY_ESCALATION");
  const campaignInput: NewGlwCampaignInput = { ...input.campaignInput, publicationPolicy: input.authoritativePublicationPolicy };
  const identities = (campaignInput.cityTargets ?? []).map((target) => normalizeGlwGlobalCityTargetIdentity({ organizationId: campaignInput.organizationId, siteId: campaignInput.siteId, productId: campaignInput.productId, pageType: campaignInput.pageType, ...target }));
  const orderedKeys = identities.map(createGlwGlobalCityTargetKey).sort();
  if (identities.length === 0 || new Set(orderedKeys).size !== identities.length) throw new Error("GLW_LAUNCH_TARGET_COHORT_INVALID");
  const launchId = createGlwCampaignLaunchId({ organizationId: campaignInput.organizationId, siteId: campaignInput.siteId, productId: campaignInput.productId, pageType: "city_service", publicationPolicy: input.authoritativePublicationPolicy, targets: identities });
  const expectedCampaignId = dependencies.createCampaignId(campaignInput);

  const reservation = saveWithRetry((state) => {
    const existingLaunch = state.launches.find((entry) => entry.launchId === launchId);
    if (existingLaunch && existingLaunch.state !== "COMPENSATED") {
      const existingCampaign = dependencies.listCampaigns().find((campaign) => existingLaunch.campaignId ? campaign.campaignId === existingLaunch.campaignId : campaignMatchesInput(campaign, campaignInput)) ?? null;
      if (existingLaunch.state === "TARGETS_RESERVED" && existingLaunch.campaignId === null) return { state, value: { state: "REFERENCE_GENERATION_REQUIRED", launch: existingLaunch, campaign: existingCampaign, conflicts: [] }, persist: false };
      return { state, value: { state: "ALREADY_EXISTS", launch: existingLaunch, campaign: existingCampaign, conflicts: [] }, persist: false };
    }
    const materialized = materializeExistingOwnership(dependencies.listCampaigns(), dependencies.listTargets());
    if (materialized.conflicts.length > 0) return { state, value: { state: "HISTORICAL_OWNERSHIP_CONFLICT", launch: null, campaign: null, conflicts: materialized.conflicts.map((conflict) => ({ globalTargetKey: conflict.globalTargetKey, campaignId: conflict.campaignIds.join(","), state: "UNRECONCILED" })) }, persist: false };
    const combined = new Map(state.ownership.map((entry) => [entry.globalTargetKey, entry]));
    for (const entry of materialized.ownership) {
      const current = combined.get(entry.globalTargetKey);
      if (current && current.campaignId !== entry.campaignId) return { state, value: { state: "HISTORICAL_OWNERSHIP_CONFLICT", launch: null, campaign: null, conflicts: [{ globalTargetKey: entry.globalTargetKey, campaignId: current.campaignId, state: "UNRECONCILED" }] }, persist: false };
      combined.set(entry.globalTargetKey, { ...entry, launchId: current?.launchId ?? null });
    }
    const conflicts = orderedKeys.map((key) => combined.get(key)).filter((entry): entry is GlwGlobalTargetOwnership => Boolean(entry));
    if (conflicts.length > 0) return { state, value: { state: "TARGET_CONFLICT", launch: null, campaign: null, conflicts: conflicts.map((entry) => ({ globalTargetKey: entry.globalTargetKey, campaignId: entry.campaignId, state: entry.state })) }, persist: false };
    const timestamp = new Date().toISOString();
    const launch: GlwCampaignLaunchRecord = existingLaunch
      ? { ...existingLaunch, campaignId: null, state: "TARGETS_RESERVED", referenceJobId: null, dispatchState: "NOT_STARTED", recoveryReason: null, events: [...existingLaunch.events, event("TARGETS_RESERVED", "Retry after compensated pre-campaign failure")], updatedAt: timestamp }
      : { launchId, idempotencyKey: launchId, campaignId: null, organizationId: normalizeId(campaignInput.organizationId), siteId: normalizeId(campaignInput.siteId), productId: normalizeId(campaignInput.productId), pageType: "city_service", publicationPolicy: input.authoritativePublicationPolicy, orderedGlobalTargetKeys: orderedKeys, referenceTarget: [...identities].sort((a, b) => createGlwGlobalCityTargetKey(a).localeCompare(createGlwGlobalCityTargetKey(b)))[0], state: "TARGETS_RESERVED", referenceJobId: null, dispatchState: "NOT_STARTED", recoveryReason: null, events: [event("TARGETS_RESERVED")], createdAt: timestamp, updatedAt: timestamp };
    for (const identity of identities) {
      const globalTargetKey = createGlwGlobalCityTargetKey(identity);
      combined.set(globalTargetKey, { globalTargetKey, launchId, campaignId: null, identity, state: "RESERVED", targetStatus: null, reservedAt: timestamp, updatedAt: timestamp });
    }
    const nextState = { ...state, ownership: [...combined.values()], launches: existingLaunch ? state.launches.map((entry) => entry.launchId === launchId ? launch : entry) : [...state.launches, launch] };
    return { state: nextState, value: { state: "REFERENCE_GENERATION_REQUIRED", launch, campaign: null, conflicts: [] } };
  });
  if (reservation.state !== "REFERENCE_GENERATION_REQUIRED") return reservation;

  let campaign = reservation.campaign ?? dependencies.listCampaigns().find((entry) => entry.campaignId === expectedCampaignId) ?? null;
  try {
    if (!campaign) {
      const created = dependencies.createCampaign(campaignInput);
      campaign = created.campaign;
      if (!campaign) throw new Error(created.errors.join("; ") || "GLW_CAMPAIGN_CREATION_FAILED");
    }
    if (!campaignMatchesInput(campaign, campaignInput)) throw new Error("GLW_CAMPAIGN_IDENTITY_MISMATCH");
    dependencies.afterCampaignCreated?.(campaign);
  } catch (error) {
    campaign = dependencies.listCampaigns().find((entry) => entry.campaignId === expectedCampaignId) ?? null;
    if (!campaign) {
      const compensated = saveWithRetry((state) => {
        const launch = state.launches.find((entry) => entry.launchId === launchId)!;
        const updated = { ...launch, state: "COMPENSATED" as const, recoveryReason: error instanceof Error ? error.message : "GLW_CAMPAIGN_CREATION_FAILED", events: [...launch.events, event("COMPENSATED", error instanceof Error ? error.message : null)], updatedAt: new Date().toISOString() };
        return { state: { ...state, ownership: state.ownership.filter((entry) => entry.launchId !== launchId), launches: state.launches.map((entry) => entry.launchId === launchId ? updated : entry) }, value: { state: "COMPENSATED", launch: updated, campaign: null, conflicts: [] } };
      });
      return compensated;
    }
    if (!campaignMatchesInput(campaign, campaignInput)) return { state: "RECOVERY_REQUIRED", launch: finalizeLaunchReservation(launchId, campaign, "Campaign persisted with mismatched launch identity", "GLW_CAMPAIGN_IDENTITY_MISMATCH"), campaign, conflicts: [] };
  }

  dependencies.beforeReservationFinalized?.(campaign);
  const launch = finalizeLaunchReservation(launchId, campaign);
  return { state: "REFERENCE_GENERATION_REQUIRED", launch, campaign, conflicts: [] };
}

export function getGlwCampaignLaunchByCampaignId(campaignId: string): GlwCampaignLaunchRecord | null {
  return deepClone(loadPersistedState<LaunchAuthorityState>({ namespace: NAMESPACE, seedFactory: seed }).state.launches.find((entry) => entry.campaignId === campaignId) ?? null);
}

export function listGlwGlobalTargetOwnership(): readonly GlwGlobalTargetOwnership[] {
  return deepClone(loadPersistedState<LaunchAuthorityState>({ namespace: NAMESPACE, seedFactory: seed }).state.ownership);
}

export function recordGlwCampaignLaunchReferenceStarted(campaignId: string, jobId: string | null): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaignId);
  return launch ? updateLaunchState(launch.launchId, "REFERENCE_GENERATION_STARTED", null, { referenceJobId: jobId }) : null;
}

export function recordGlwCampaignLaunchReferenceReviewRequired(campaignId: string, jobId: string): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaignId);
  return launch ? updateLaunchState(launch.launchId, "REFERENCE_REVIEW_REQUIRED", null, { referenceJobId: jobId }) : null;
}

export function recordGlwCampaignLaunchReferenceFailure(campaignId: string, reason: string): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaignId);
  return launch ? updateLaunchState(launch.launchId, "REFERENCE_FAILED_RECOVERABLE", reason, { recoveryReason: reason }) : null;
}

export function requireGlwCampaignLaunchReservationOwnership(campaign: GlwCampaign): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaign.campaignId);
  if (!launch) return null;
  const keys = (campaign.cityTargets ?? []).map((target) => createGlwGlobalCityTargetKey(normalizeGlwGlobalCityTargetIdentity({ organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, pageType: campaign.pageType, ...target }))).sort();
  if (campaign.publicationPolicy !== launch.publicationPolicy || JSON.stringify(keys) !== JSON.stringify(launch.orderedGlobalTargetKeys)) throw new Error("GLW_LAUNCH_RESERVATION_AUTHORITY_CHANGED");
  const ownership = listGlwGlobalTargetOwnership().filter((entry) => entry.launchId === launch.launchId);
  if (ownership.length !== keys.length || ownership.some((entry) => !keys.includes(entry.globalTargetKey) || entry.campaignId !== campaign.campaignId || entry.state === "UNRECONCILED")) throw new Error("GLW_LAUNCH_RESERVATION_READBACK_FAILED");
  return launch;
}

export function recordGlwCampaignLaunchActivated(campaign: GlwCampaign, targets: readonly GlwCampaignTarget[]): GlwCampaignLaunchRecord | null {
  const launch = requireGlwCampaignLaunchReservationOwnership(campaign);
  if (!launch) return null;
  const targetKeys = targets.map((target) => createGlwGlobalCityTargetKey(normalizeGlwGlobalCityTargetIdentity({ ...target, pageType: campaign.pageType, citySlug: target.citySlug ?? "", cityName: target.cityName ?? "" }))).sort();
  if (JSON.stringify(targetKeys) !== JSON.stringify(launch.orderedGlobalTargetKeys)) throw new Error("GLW_LAUNCH_TARGET_INITIALIZATION_MISMATCH");
  const result = saveWithRetry((state) => {
    const current = state.launches.find((entry) => entry.launchId === launch.launchId);
    if (!current) throw new Error("GLW_LAUNCH_NOT_FOUND");
    const timestamp = new Date().toISOString();
    const updated: GlwCampaignLaunchRecord = { ...current, state: "ACTIVE", recoveryReason: null, events: [...current.events, event("ACTIVE")], updatedAt: timestamp };
    const ownership = state.ownership.map((entry) => entry.launchId === launch.launchId ? { ...entry, state: "OWNED" as const, targetStatus: targets.find((target) => target.citySlug === entry.identity.citySlug && target.stateCode === entry.identity.stateCode)?.status ?? null, updatedAt: timestamp } : entry);
    return { state: { ...state, ownership, launches: state.launches.map((entry) => entry.launchId === launch.launchId ? updated : entry) }, value: { state: "ALREADY_EXISTS", launch: updated, campaign, conflicts: [] } };
  });
  return result.launch;
}

export function recordGlwCampaignLaunchDispatch(campaignId: string, errorCount: number): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaignId);
  if (!launch) return null;
  return errorCount > 0
    ? updateLaunchState(launch.launchId, "DISPATCH_RECOVERY_REQUIRED", `${errorCount} dispatch error(s)`, { dispatchState: "RECOVERY_REQUIRED", recoveryReason: `${errorCount} dispatch error(s)` })
    : updateLaunchState(launch.launchId, "DISPATCH_STARTED", null, { dispatchState: "STARTED", recoveryReason: null });
}

export function resetGlwCampaignLaunchAuthorityForTests(): void {
  resetPersistedState<LaunchAuthorityState>({ namespace: NAMESPACE, seedFactory: seed });
}

export function reconcileGlwGlobalTargetOwnership(input: { campaigns: readonly GlwCampaign[]; targets: readonly GlwCampaignTarget[] }): {
  ownershipCount: number;
  conflicts: readonly GlwHistoricalOwnershipConflict[];
} {
  const materialized = materializeExistingOwnership(input.campaigns, input.targets);
  if (materialized.conflicts.length > 0) return { ownershipCount: 0, conflicts: materialized.conflicts };
  const result = saveWithRetry((state) => {
    const combined = new Map(state.ownership.map((entry) => [entry.globalTargetKey, entry]));
    for (const entry of materialized.ownership) {
      const current = combined.get(entry.globalTargetKey);
      if (current && current.campaignId !== entry.campaignId) throw new Error("GLW_GLOBAL_OWNERSHIP_DIVERGENCE");
      combined.set(entry.globalTargetKey, { ...entry, launchId: current?.launchId ?? null });
    }
    return { state: { ...state, ownership: [...combined.values()] }, value: { state: "ALREADY_EXISTS", launch: null, campaign: null, conflicts: [] } };
  });
  void result;
  return { ownershipCount: listGlwGlobalTargetOwnership().length, conflicts: [] };
}

export function recordGlwCampaignLaunchReferenceApproved(campaignId: string, jobId: string): GlwCampaignLaunchRecord | null {
  const launch = getGlwCampaignLaunchByCampaignId(campaignId);
  return launch ? updateLaunchState(launch.launchId, "REFERENCE_APPROVED", null, { referenceJobId: jobId, recoveryReason: null }) : null;
}

export function listGlwCampaignLaunches(): readonly GlwCampaignLaunchRecord[] {
  return deepClone(loadPersistedState<LaunchAuthorityState>({ namespace: NAMESPACE, seedFactory: seed }).state.launches);
}