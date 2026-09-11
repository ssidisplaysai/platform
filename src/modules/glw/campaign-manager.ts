import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";
import { GLW_CITIES } from "./page-generation";
import type { GlwCampaign, GlwCampaignPageType, GlwCampaignPublicationPolicy } from "./campaign-types";
import type { GlwCampaignTarget, GlwCampaignTargetQueueSummary } from "./campaign-target-repository";

export type GlwCampaignDisplayState = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
export type GlwCampaignCoverageState = "completed" | "active" | "incomplete" | "uncovered";

export type GlwCampaignManagerRecord = {
  campaign: GlwCampaign;
  summary: GlwCampaignTargetQueueSummary;
  displayState: GlwCampaignDisplayState;
  completedAt: string | null;
  completedCount: number;
  unresolvedCount: number;
};

export type GlwCampaignContinuationProposal = {
  parentCampaignId: string;
  originReason: string;
  name: string;
  productId: string;
  pageType: GlwCampaignPageType;
  stateCodes: readonly string[];
  pagesPerDay: number;
  publicationPolicy: GlwCampaignPublicationPolicy;
};

export type GlwCampaignStateCoverage = {
  code: string;
  name: string;
  state: GlwCampaignCoverageState;
  campaignIds: readonly string[];
  targetCount: number;
  completedCount: number;
  failedCount: number;
};

const COMPLETED_TARGET_STATES = new Set<GlwCampaignTarget["status"]>([
  "reference_complete",
  "draft_ready",
  "published",
]);
const CITY_SUPPORTED_STATE_CODES = [...new Set(GLW_CITIES.map((city) => city.stateCode))];

function campaignProductName(campaign: GlwCampaign): string {
  const geographyNames = campaign.stateCodes
    .map((code) => GLW_CAMPAIGN_US_STATES.find((state) => state.code === code)?.name)
    .filter((name): name is string => Boolean(name));
  let value = campaign.name.replace(/\s+(50 States|Major Cities|Cities|Overview)$/u, "");
  for (const geography of geographyNames) value = value.replace(new RegExp(`\\s+${geography}$`, "u"), "");
  return value.trim();
}

export function summarizeCampaignTargets(targets: readonly GlwCampaignTarget[]): GlwCampaignTargetQueueSummary {
  return {
    total: targets.length,
    referenceComplete: targets.filter((target) => target.status === "reference_complete").length,
    queued: targets.filter((target) => target.status === "queued").length,
    running: targets.filter((target) => target.status === "running").length,
    draftReady: targets.filter((target) => target.status === "draft_ready").length,
    published: targets.filter((target) => target.status === "published").length,
    failed: targets.filter((target) => target.status === "failed").length,
    skipped: targets.filter((target) => target.status === "skipped").length,
  };
}

export function projectGlwCampaign(
  campaign: GlwCampaign,
  targets: readonly GlwCampaignTarget[],
): GlwCampaignManagerRecord {
  const summary = summarizeCampaignTargets(targets);
  const complete = targets.length > 0
    ? targets.every((target) => COMPLETED_TARGET_STATES.has(target.status))
    : campaign.status === "complete";
  const displayState: GlwCampaignDisplayState = complete
    ? "COMPLETED"
    : campaign.status === "draft"
      ? "DRAFT"
      : campaign.status === "paused"
        ? "PAUSED"
        : "ACTIVE";
  const completedAt = displayState === "COMPLETED"
    ? targets.reduce<string | null>((latest, target) => !latest || target.updatedAt > latest ? target.updatedAt : latest, null)
    : null;
  return {
    campaign,
    summary,
    displayState,
    completedAt,
    completedCount: summary.referenceComplete + summary.draftReady + summary.published,
    unresolvedCount: summary.queued + summary.running + summary.failed + summary.skipped,
  };
}

export function recommendGlwCampaignContinuation(input: {
  record: GlwCampaignManagerRecord;
  campaigns: readonly GlwCampaign[];
}): GlwCampaignContinuationProposal | null {
  if (input.record.displayState !== "COMPLETED") return null;
  const parent = input.record.campaign;
  if (parent.pageType === "state_service") {
    const cityStates = parent.stateCodes.filter((code) => CITY_SUPPORTED_STATE_CODES.includes(code));
    if (cityStates.length === 0) return null;
    return {
      parentCampaignId: parent.campaignId,
      originReason: "Completed state coverage can expand into city coverage for the same product.",
      name: `${campaignProductName(parent)} Major Cities`,
      productId: parent.productId,
      pageType: "city_service",
      stateCodes: cityStates,
      pagesPerDay: parent.pagesPerDay,
      publicationPolicy: parent.publicationPolicy,
    };
  }
  const coveredStates = new Set(input.campaigns
    .filter((campaign) => campaign.productId === parent.productId && campaign.pageType === "city_service")
    .flatMap((campaign) => campaign.stateCodes));
  const nextStateCode = CITY_SUPPORTED_STATE_CODES.find((code) => !coveredStates.has(code));
  const nextState = GLW_CAMPAIGN_US_STATES.find((state) => state.code === nextStateCode);
  if (!nextState) return null;
  return {
    parentCampaignId: parent.campaignId,
    originReason: `${nextState.name} is the next uncovered state for this product's city expansion.`,
    name: `${campaignProductName(parent)} ${nextState.name} Cities`,
    productId: parent.productId,
    pageType: "city_service",
    stateCodes: [nextState.code],
    pagesPerDay: parent.pagesPerDay,
    publicationPolicy: parent.publicationPolicy,
  };
}

export function buildGlwStateCoverage(input: {
  campaigns: readonly GlwCampaign[];
  targets: readonly GlwCampaignTarget[];
  organizationId: string;
  siteId: string;
}): readonly GlwCampaignStateCoverage[] {
  const campaigns = input.campaigns.filter((campaign) =>
    campaign.organizationId === input.organizationId && campaign.siteId === input.siteId);
  const campaignIds = new Set(campaigns.map((campaign) => campaign.campaignId));
  const targets = input.targets.filter((target) => campaignIds.has(target.campaignId)
    && target.organizationId === input.organizationId && target.siteId === input.siteId);
  return GLW_CAMPAIGN_US_STATES.map((state) => {
    const stateTargets = targets.filter((target) => target.stateCode === state.code);
    const failedCount = stateTargets.filter((target) => target.status === "failed").length;
    const completedCount = stateTargets.filter((target) => COMPLETED_TARGET_STATES.has(target.status)).length;
    const activeCount = stateTargets.filter((target) => target.status === "queued" || target.status === "running").length;
    const coverageState: GlwCampaignCoverageState = stateTargets.length === 0
      ? "uncovered"
      : failedCount > 0
        ? "incomplete"
        : activeCount > 0
          ? "active"
          : completedCount === stateTargets.length
            ? "completed"
            : "incomplete";
    return {
      code: state.code,
      name: state.name,
      state: coverageState,
      campaignIds: [...new Set(stateTargets.map((target) => target.campaignId))],
      targetCount: stateTargets.length,
      completedCount,
      failedCount,
    };
  });
}

export function createSpinOffDraftInput(input: {
  parent: GlwCampaign;
  proposal: GlwCampaignContinuationProposal;
}): Omit<import("./campaign-types").NewGlwCampaignInput, "cityTargets"> {
  return {
    organizationId: input.parent.organizationId,
    siteId: input.parent.siteId,
    productId: input.proposal.productId,
    name: input.proposal.name,
    pageType: input.proposal.pageType,
    stateCodes: input.proposal.stateCodes,
    pagesPerDay: input.proposal.pagesPerDay,
    publicationPolicy: input.proposal.publicationPolicy,
    imageRequired: input.parent.imageRequired,
    parentCampaignId: input.parent.campaignId,
    originReason: input.proposal.originReason,
  };
}