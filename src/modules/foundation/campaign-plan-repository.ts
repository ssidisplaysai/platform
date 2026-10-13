import { createCanonicalContentHash } from "./canonical-content-hash";
import type { CampaignPlan } from "./campaign-plan";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";

const PERSISTENCE_NAMESPACE = "campaign-plan-repository";

type CampaignPlanRepositoryState = {
  campaigns: CampaignPlan[];
};

export class CampaignPlanRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignPlanRepositoryError";
    this.code = code;
  }
}

const campaignStore = new Map<string, CampaignPlan>();
let stateRevision = 0;

function emptyState(): CampaignPlanRepositoryState {
  return { campaigns: [] };
}

function applyState(state: CampaignPlanRepositoryState): void {
  campaignStore.clear();
  state.campaigns.forEach((campaign) => campaignStore.set(campaign.campaignId, deepClone(campaign)));
}

function snapshotState(): CampaignPlanRepositoryState {
  return { campaigns: [...campaignStore.values()].map((campaign) => deepClone(campaign)) };
}

const loaded = loadPersistedState<CampaignPlanRepositoryState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: emptyState,
});
applyState(loaded.state);
stateRevision = loaded.revision;

function persistCurrentState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

function immutableScope(campaign: CampaignPlan): unknown {
  return {
    campaignId: campaign.campaignId,
    matrixFingerprint: campaign.matrixFingerprint,
    matrixId: campaign.matrixId,
    catalogAuthority: campaign.catalogAuthority,
    catalogRevisionId: campaign.catalogRevisionId,
    reconciliationPlanFingerprint: campaign.reconciliationPlanFingerprint,
    pageBlueprintVersions: campaign.pageBlueprintVersions,
    publicationIntent: campaign.publicationIntent,
    targetCount: campaign.targetCount,
    targetIds: campaign.targetIds,
    preflightPolicyVersion: campaign.preflightPolicyVersion,
    fingerprint: campaign.fingerprint,
  };
}

function assertSameScope(existing: CampaignPlan, candidate: CampaignPlan): void {
  if (createCanonicalContentHash(immutableScope(existing)) !== createCanonicalContentHash(immutableScope(candidate))) {
    throw new CampaignPlanRepositoryError("CAMPAIGN_SCOPE_IMMUTABLE", "Campaign scope cannot change under an existing campaign ID.");
  }
}

export function createCampaignPlanRecord(campaign: CampaignPlan): CampaignPlan {
  const existing = campaignStore.get(campaign.campaignId);
  if (existing) {
    assertSameScope(existing, campaign);
    return deepClone(existing);
  }
  const before = snapshotState();
  try {
    campaignStore.set(campaign.campaignId, deepClone(campaign));
    persistCurrentState();
    return deepClone(campaign);
  } catch (error) {
    applyState(before);
    throw error;
  }
}

export function getCampaignPlanRecord(campaignId: string): CampaignPlan | null {
  const campaign = campaignStore.get(campaignId);
  return campaign ? deepClone(campaign) : null;
}

export function listCampaignPlanRecords(filters: {
  organizationId?: string;
  siteId?: string;
  status?: CampaignPlan["status"];
} = {}): readonly CampaignPlan[] {
  return [...campaignStore.values()]
    .filter((campaign) => !filters.organizationId || campaign.organizationId === filters.organizationId)
    .filter((campaign) => !filters.siteId || campaign.siteId === filters.siteId)
    .filter((campaign) => !filters.status || campaign.status === filters.status)
    .sort((left, right) => left.campaignId.localeCompare(right.campaignId))
    .map((campaign) => deepClone(campaign));
}

export function saveCampaignPreflightRecord(input: {
  campaign: CampaignPlan;
  expectedVersion: number;
}): CampaignPlan {
  const existing = campaignStore.get(input.campaign.campaignId);
  if (!existing) throw new CampaignPlanRepositoryError("CAMPAIGN_NOT_FOUND", `Campaign not found: ${input.campaign.campaignId}`);
  assertSameScope(existing, input.campaign);
  if (existing.version !== input.expectedVersion) {
    throw new CampaignPlanRepositoryError("CAMPAIGN_VERSION_CONFLICT", `Expected campaign version ${input.expectedVersion}, found ${existing.version}.`);
  }
  if (input.campaign.status === "APPROVED" || input.campaign.status === "EXECUTING" || input.campaign.status === "COMPLETE") {
    throw new CampaignPlanRepositoryError("STATUS_NOT_ALLOWED_002C", "002C cannot persist approved or executing campaign states.");
  }
  const before = snapshotState();
  try {
    campaignStore.set(input.campaign.campaignId, deepClone(input.campaign));
    persistCurrentState();
    return deepClone(input.campaign);
  } catch (error) {
    applyState(before);
    throw error;
  }
}

export function resetCampaignPlanRepositoryForTests(): void {
  const reset = resetPersistedState<CampaignPlanRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: emptyState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
}