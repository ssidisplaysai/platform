import Module from "node:module";

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function load(request: unknown, ...args: unknown[]) {
  return request === "server-only" ? {} : originalLoad.call(this, request, ...args);
};

const { launchGlwCityCampaign } = await import("../../campaign-launch-authority");
const name = process.env.GLW_TEST_LAUNCH_NAME ?? "Concurrent";
const cityTargets = JSON.parse(process.env.GLW_TEST_CITY_TARGETS ?? "[]") as Array<{ stateCode: string; citySlug: string; cityName: string }>;
const campaigns: unknown[] = [];
const campaignInput = { organizationId: "org", siteId: "site", productId: "product", name, pageType: "city_service" as const, stateCodes: ["CA"], cityTargets, pagesPerDay: 10, publicationPolicy: "draft_only" as const, imageRequired: true };
const result = launchGlwCityCampaign({ campaignInput, authoritativePublicationPolicy: "draft_only", publicationPolicyAcknowledgement: "draft_only" }, {
  listCampaigns: () => campaigns as never[],
  listTargets: () => [],
  createCampaignId: (input) => `campaign-${input.name.toLowerCase()}`,
  createCampaign: (input) => {
    const campaign = { ...input, campaignId: `campaign-${input.name.toLowerCase()}`, status: "draft" as const, completedTargetCount: 0, failedTargetCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    campaigns.push(campaign);
    return { campaign, errors: [] };
  },
});
console.log(JSON.stringify({ state: result.state, ownership: result.launch?.orderedGlobalTargetKeys ?? [] }));