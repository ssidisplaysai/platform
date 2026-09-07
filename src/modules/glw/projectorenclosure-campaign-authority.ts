import type { NewGlwCampaignInput } from "./campaign-types";

export const PE_FAN_COOLED_STARTER_CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-starter-cities";
export const PE_FAN_COOLED_STARTER_REFERENCE = { stateCode: "CA", citySlug: "anaheim", cityName: "Anaheim" } as const;
export const PE_FAN_COOLED_STARTER_TARGETS = [PE_FAN_COOLED_STARTER_REFERENCE, { stateCode: "CA", citySlug: "santa-ana", cityName: "Santa Ana" }] as const;
export const PE_FAN_COOLED_EXPANDED_CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-expanded-cities";
export const PE_FAN_COOLED_EXPANDED_REFERENCE = { stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" } as const;
export const PE_FAN_COOLED_EXPANDED_TARGETS = [
  PE_FAN_COOLED_EXPANDED_REFERENCE,
  { stateCode: "CA", citySlug: "san-diego", cityName: "San Diego" },
  { stateCode: "CA", citySlug: "san-francisco", cityName: "San Francisco" },
  { stateCode: "CA", citySlug: "san-jose", cityName: "San Jose" },
  { stateCode: "CA", citySlug: "sacramento", cityName: "Sacramento" },
  { stateCode: "CA", citySlug: "fresno", cityName: "Fresno" },
  { stateCode: "CA", citySlug: "long-beach", cityName: "Long Beach" },
  { stateCode: "CA", citySlug: "oakland", cityName: "Oakland" },
  { stateCode: "CA", citySlug: "bakersfield", cityName: "Bakersfield" },
  { stateCode: "CA", citySlug: "riverside", cityName: "Riverside" },
] as const;

export function buildPeFanCooledStarterCampaignInput(): NewGlwCampaignInput {
  return { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", name: "Fan Cooled Projector Enclosures California Starter Cities", pageType: "city_service", stateCodes: ["CA"], cityTargets: PE_FAN_COOLED_STARTER_TARGETS, pagesPerDay: 1, publicationPolicy: "draft_only", imageRequired: true };
}

export function buildPeFanCooledExpandedCampaignInput(): NewGlwCampaignInput {
  return { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", name: "Fan Cooled Projector Enclosures California Expanded Cities", pageType: "city_service", stateCodes: ["CA"], cityTargets: PE_FAN_COOLED_EXPANDED_TARGETS, pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true };
}

export function isPeFanCooledStarterCampaignRequest(input: { campaignId?: string | null; siteId: string; productId: string; pageType: string; stateCode: string; citySlug?: string | null }): boolean {
  return input.campaignId === PE_FAN_COOLED_STARTER_CAMPAIGN_ID && input.siteId === "site-ssi-projectorenclosure" && input.productId === "prod-ssi-fan-cooled-projector-enclosures" && input.pageType === "city_service" && input.stateCode === "CA" && PE_FAN_COOLED_STARTER_TARGETS.some((target) => target.citySlug === input.citySlug);
}

export function isPeFanCooledCampaignRequest(input: { campaignId?: string | null; siteId: string; productId: string; pageType: string; stateCode: string; citySlug?: string | null }): boolean {
  const targets = input.campaignId === PE_FAN_COOLED_STARTER_CAMPAIGN_ID
    ? PE_FAN_COOLED_STARTER_TARGETS
    : input.campaignId === PE_FAN_COOLED_EXPANDED_CAMPAIGN_ID
      ? PE_FAN_COOLED_EXPANDED_TARGETS
      : [];
  return input.siteId === "site-ssi-projectorenclosure" && input.productId === "prod-ssi-fan-cooled-projector-enclosures" && input.pageType === "city_service" && input.stateCode === "CA" && targets.some((target) => target.citySlug === input.citySlug);
}