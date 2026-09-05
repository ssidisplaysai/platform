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

function normalizeStateCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCitySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validate(input: NewGlwCampaignInput): string[] {
  const errors: string[] = [];
  const validStates = new Set(GLW_CAMPAIGN_ALL_STATE_CODES);
  const stateCodes = input.stateCodes.map(normalizeStateCode);

  if (!input.organizationId.trim()) errors.push("Organization is required.");
  if (!input.siteId.trim()) errors.push("Site is required.");
  if (!input.productId.trim()) errors.push("Product is required.");
  if (!input.name.trim()) errors.push("Campaign name is required.");
  if (input.pagesPerDay < 1 || input.pagesPerDay > 100) {
    errors.push("Pages per day must be between 1 and 100.");
  }
  if (stateCodes.length < 1) errors.push("At least one state is required.");
  if (new Set(stateCodes).size !== stateCodes.length) {
    errors.push("State targets must be unique.");
  }
  if (stateCodes.some((code) => !validStates.has(code))) {
    errors.push("Campaign includes an invalid state code.");
  }

  const cityTargets = input.cityTargets ?? [];

  if (input.pageType === "state_service") {
    if (cityTargets.length > 0) {
      errors.push("State campaigns cannot include city targets.");
    }
  } else if (input.pageType === "city_service") {
    if (cityTargets.length < 1) {
      errors.push("City campaigns require at least one city target.");
    }

    const identities = cityTargets.map((target) => {
      const stateCode = normalizeStateCode(target.stateCode);
      const citySlug = normalizeCitySlug(target.citySlug);
      const cityName = target.cityName.trim();

      if (!validStates.has(stateCode)) {
        errors.push(`City target ${target.citySlug || "<blank>"} includes an invalid state code.`);
      }
      if (!citySlug) {
        errors.push("City target slug is required.");
      }
      if (!cityName) {
        errors.push(`City target ${citySlug || "<blank>"} requires a city name.`);
      }
      if (!stateCodes.includes(stateCode)) {
        errors.push(`City target ${citySlug || "<blank>"} is outside the campaign state set.`);
      }

      return `${stateCode}::${citySlug}`;
    });

    if (new Set(identities).size !== identities.length) {
      errors.push("City targets must be unique by state and city slug.");
    }

    const cityStateCodes = Array.from(
      new Set(cityTargets.map((target) => normalizeStateCode(target.stateCode))),
    ).sort();
    const campaignStateCodes = Array.from(new Set(stateCodes)).sort();

    if (cityStateCodes.join(",") !== campaignStateCodes.join(",")) {
      errors.push("City campaign stateCodes must exactly match the states represented by cityTargets.");
    }
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
    stateCodes: input.stateCodes.map(normalizeStateCode),
    ...(input.pageType === "city_service"
      ? {
          cityTargets: (input.cityTargets ?? []).map((target) => ({
            stateCode: normalizeStateCode(target.stateCode),
            citySlug: normalizeCitySlug(target.citySlug),
            cityName: target.cityName.trim(),
          })),
        }
      : {}),
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
export function activateGlwCampaign(campaignId: string): {
  campaign: GlwCampaign | null;
  errors: readonly string[];
} {
  loadState();

  const campaign = campaignStore.get(campaignId);

  if (!campaign) {
    return {
      campaign: null,
      errors: ["Campaign not found."],
    };
  }

  if (campaign.status === "active") {
    return {
      campaign: deepClone(campaign),
      errors: [],
    };
  }

  if (campaign.status !== "draft") {
    return {
      campaign: null,
      errors: [
        `Campaign cannot activate from status ${campaign.status}.`,
      ],
    };
  }

  const updated: GlwCampaign = {
    ...campaign,
    status: "active",
    updatedAt: new Date().toISOString(),
  };

  campaignStore.set(campaignId, updated);
  persistState();

  return {
    campaign: deepClone(updated),
    errors: [],
  };
}
