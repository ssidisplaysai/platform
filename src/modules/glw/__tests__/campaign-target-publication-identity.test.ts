import {
  attachGlwCampaignTargetJob,
  initializeGlwCampaignTargets,
  initializeGlwCityCampaignTargets,
  leaseGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetPublished,
} from "../campaign-target-repository";

describe("campaign publication target identity", () => {
  test("requires the exact city slug for city targets", () => {
    const campaignId = `campaign-city-${process.pid}-${Date.now()}`;
    initializeGlwCityCampaignTargets({ campaignId, organizationId: "org", siteId: "site", productId: "product", cityTargets: [{ stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" }, { stateCode: "CA", citySlug: "fresno", cityName: "Fresno" }], referenceTarget: { stateCode: "CA", citySlug: "los-angeles" }, referenceJobId: "reference-job", referenceWordpressObjectId: "100" });
    leaseGlwCampaignTargets({ campaignId, pagesPerDay: 1, dispatchDate: "2026-09-07", leaseId: "lease-city" });
    attachGlwCampaignTargetJob({ campaignId, stateCode: "CA", citySlug: "fresno", leaseId: "lease-city", jobId: "job-fresno" });
    markGlwCampaignTargetDraftReady({ campaignId, stateCode: "CA", citySlug: "fresno", jobId: "job-fresno", wordpressObjectId: "101" });
    expect(() => markGlwCampaignTargetPublished({ campaignId, stateCode: "CA", wordpressObjectId: "101" })).toThrow("exact draft-ready");
    expect(() => markGlwCampaignTargetPublished({ campaignId, stateCode: "CA", citySlug: "wrong", wordpressObjectId: "101" })).toThrow("exact draft-ready");
    expect(markGlwCampaignTargetPublished({ campaignId, stateCode: "CA", citySlug: "fresno", wordpressObjectId: "101" }).status).toBe("published");
    expect(() => markGlwCampaignTargetPublished({ campaignId, stateCode: "CA", citySlug: "fresno", wordpressObjectId: "101" })).toThrow("exact draft-ready");
  });

  test("keeps state targets valid without city identity and enforces WordPress ownership", () => {
    const campaignId = `campaign-state-${process.pid}-${Date.now()}`;
    initializeGlwCampaignTargets({ campaignId, organizationId: "org", siteId: "site", productId: "product", stateCodes: ["CA", "TX"], referenceStateCode: "CA", referenceJobId: "reference-job", referenceWordpressObjectId: "200" });
    leaseGlwCampaignTargets({ campaignId, pagesPerDay: 1, dispatchDate: "2026-09-07", leaseId: "lease-state" });
    attachGlwCampaignTargetJob({ campaignId, stateCode: "TX", leaseId: "lease-state", jobId: "job-texas" });
    markGlwCampaignTargetDraftReady({ campaignId, stateCode: "TX", jobId: "job-texas", wordpressObjectId: "201" });
    expect(() => markGlwCampaignTargetPublished({ campaignId, stateCode: "TX", wordpressObjectId: "wrong" })).toThrow("exact draft-ready");
    expect(markGlwCampaignTargetPublished({ campaignId, stateCode: "TX", wordpressObjectId: "201" }).status).toBe("published");
  });
});