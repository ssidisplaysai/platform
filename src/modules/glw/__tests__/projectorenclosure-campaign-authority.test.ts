import { buildPeFanCooledStarterCampaignInput, isPeFanCooledStarterCampaignRequest, PE_FAN_COOLED_STARTER_CAMPAIGN_ID, PE_FAN_COOLED_STARTER_TARGETS } from "../projectorenclosure-campaign-authority";

describe("PE Fan Cooled starter campaign authority", () => {
  test("defines an exact two-city draft-only CA starter cohort", () => {
    expect(buildPeFanCooledStarterCampaignInput()).toEqual({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", name: "Fan Cooled Projector Enclosures California Starter Cities", pageType: "city_service", stateCodes: ["CA"], cityTargets: [{ stateCode: "CA", citySlug: "anaheim", cityName: "Anaheim" }, { stateCode: "CA", citySlug: "santa-ana", cityName: "Santa Ana" }], pagesPerDay: 1, publicationPolicy: "draft_only", imageRequired: true });
    expect(PE_FAN_COOLED_STARTER_TARGETS).toHaveLength(2);
    expect(PE_FAN_COOLED_STARTER_TARGETS.some((target) => target.citySlug === "irvine")).toBe(false);
  });

  test("matches only the exact PE campaign and approved targets", () => {
    expect(isPeFanCooledStarterCampaignRequest({ campaignId: PE_FAN_COOLED_STARTER_CAMPAIGN_ID, siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", pageType: "city_service", stateCode: "CA", citySlug: "anaheim" })).toBe(true);
    expect(isPeFanCooledStarterCampaignRequest({ campaignId: "other", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", pageType: "city_service", stateCode: "CA", citySlug: "anaheim" })).toBe(false);
    expect(isPeFanCooledStarterCampaignRequest({ campaignId: PE_FAN_COOLED_STARTER_CAMPAIGN_ID, siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", pageType: "city_service", stateCode: "CA", citySlug: "irvine" })).toBe(false);
  });
});