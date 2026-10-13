import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";

type Counts = { campaigns: number; targets: number; generatedPagesRequiringReview: number };

function counts(campaigns: readonly Pick<GlwCampaign, "campaignId">[], targets: readonly Pick<GlwCampaignTarget, "campaignId" | "status">[]): Counts {
  const campaignIds = new Set(campaigns.map((campaign) => campaign.campaignId));
  const ownedTargets = targets.filter((target) => campaignIds.has(target.campaignId));
  return {
    campaigns: campaigns.length,
    targets: ownedTargets.length,
    generatedPagesRequiringReview: ownedTargets.filter((target) => target.status === "draft_ready").length,
  };
}

export function deriveOperatorNavigationSummary(input: {
  campaigns: readonly Pick<GlwCampaign, "campaignId" | "organizationId" | "siteId">[];
  targets: readonly Pick<GlwCampaignTarget, "campaignId" | "status">[];
  organizationId: string | null;
  siteId: string | null;
}) {
  const scopedCampaigns = input.campaigns.filter((campaign) =>
    (!input.organizationId || campaign.organizationId === input.organizationId)
    && (!input.siteId || campaign.siteId === input.siteId));
  return {
    global: counts(input.campaigns, input.targets),
    scoped: counts(scopedCampaigns, input.targets),
    generatedPagesCountDefinition: "draft_ready campaign targets" as const,
  };
}