import type { NewGlwCampaignInput } from "./campaign-types";

export const PE_FAN_COOLED_STARTER_CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-starter-cities";
export const PE_FAN_COOLED_STARTER_REFERENCE = { stateCode: "CA", citySlug: "anaheim", cityName: "Anaheim" } as const;
export const PE_FAN_COOLED_STARTER_TARGETS = [PE_FAN_COOLED_STARTER_REFERENCE, { stateCode: "CA", citySlug: "santa-ana", cityName: "Santa Ana" }] as const;

export function buildPeFanCooledStarterCampaignInput(): NewGlwCampaignInput {
  return { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", name: "Fan Cooled Projector Enclosures California Starter Cities", pageType: "city_service", stateCodes: ["CA"], cityTargets: PE_FAN_COOLED_STARTER_TARGETS, pagesPerDay: 1, publicationPolicy: "draft_only", imageRequired: true };
}

export function isPeFanCooledStarterCampaignRequest(input: { campaignId?: string | null; siteId: string; productId: string; pageType: string; stateCode: string; citySlug?: string | null }): boolean {
  return input.campaignId === PE_FAN_COOLED_STARTER_CAMPAIGN_ID && input.siteId === "site-ssi-projectorenclosure" && input.productId === "prod-ssi-fan-cooled-projector-enclosures" && input.pageType === "city_service" && input.stateCode === "CA" && PE_FAN_COOLED_STARTER_TARGETS.some((target) => target.citySlug === input.citySlug);
}