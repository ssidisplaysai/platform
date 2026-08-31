import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import { GLW_CAMPAIGN_ALL_STATE_CODES } from "./campaign-geography";
import type { GlwCampaign, NewGlwCampaignInput } from "./campaign-types";

const PERSISTENCE_NAMESPACE = "glw-campaign-repository";

type CampaignRepositoryState = {
  campaigns: GlwCampaign[];
};

const campaignStore = new Map<string, GlwCampaign>();
let stateRevision = 0;

function createSeedState(): CampaignRepositoryState {
  return { campaigns: [] };
}

function applyState(state: CampaignRepositoryState): void {
  campaignStore.clear();
  state.campaigns.forEach((campaign) => {
    campaignStore.set(campaign.campaignId, deepClone(campaign));
  });
}

function snapshotState(): CampaignRepositoryState {
  return {
    campaigns: Array.from(campaignStore.values()).map((campaign) =>
      deepClone(campaign),
    ),
  };
}

function loadState(): void {
  const loaded = loadPersistedState<CampaignRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistState(): void {
  const saved = savePersistedState<CampaignRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

loadState();

function campaignId(input: NewGlwCampaignInput): string {
  const safe = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `campaign-${input.organizationId}-${input.siteId}-${safe}`;
}

function validate(input: NewGlwCampaignInput): string[] {
  const errors: string[] = [];
  const validStates = new Set(GLW_CAMPAIGN_ALL_STATE_CODES);

  if (!input.organizationId.trim()) errors.push("Organization is required.");
  if (!input.siteId.trim()) errors.push("Site is required.");
  if (!input.productId.trim()) errors.push("Product is required.");
  if (!input.name.trim()) errors.push("Campaign name is required.");
  if (input.pagesPerDay < 1 || input.pagesPerDay > 100) {
    errors.push("Pages per day must be between 1 and 100.");
  }
  if (input.stateCodes.length < 1) errors.push("At least one state is required.");
  if (new Set(input.stateCodes).size !== input.stateCodes.length) {
    errors.push("State targets must be unique.");
  }
  if (input.stateCodes.some((code) => !validStates.has(code))) {
    errors.push("Campaign includes an invalid state code.");
  }

  return errors;
}

export function listGlwCampaigns(): readonly GlwCampaign[] {
  loadState();
  return Array.from(campaignStore.values()).map((campaign) => deepClone(campaign));
}

export function createGlwCampaign(input: NewGlwCampaignInput): {
  campaign: GlwCampaign | null;
  errors: readonly string[];
} {
  loadState();
  const errors = validate(input);
  if (errors.length > 0) return { campaign: null, errors };

  const id = campaignId(input);
  if (campaignStore.has(id)) {
    return { campaign: null, errors: ["A campaign with this identity already exists."] };
  }

  const timestamp = new Date().toISOString();
  const campaign: GlwCampaign = {
    campaignId: id,
    organizationId: input.organizationId.trim(),
    siteId: input.siteId.trim(),
    productId: input.productId.trim(),
    name: input.name.trim(),
    pageType: input.pageType,
    stateCodes: [...input.stateCodes],
    pagesPerDay: input.pagesPerDay,
    publicationPolicy: input.publicationPolicy,
    imageRequired: input.imageRequired,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  campaignStore.set(id, campaign);
  persistState();
  return { campaign: deepClone(campaign), errors: [] };
}
