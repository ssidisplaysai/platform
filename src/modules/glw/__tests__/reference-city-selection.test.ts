import type { GlwCampaign } from "../campaign-types";
import {
  listReferenceCityOptions,
  resolveDeterministicReferenceCitySlug,
  resolveReferenceCityFromCampaign,
} from "../reference-city-selection";

function cityCampaign(): GlwCampaign {
  return {
    campaignId: "campaign-city",
    organizationId: "org",
    siteId: "site",
    productId: "product",
    name: "City Campaign",
    pageType: "city_service",
    stateCodes: ["TX", "CA"],
    cityTargets: [
      { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
      { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
      { stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" },
    ],
    pagesPerDay: 2,
    publicationPolicy: "draft_only",
    imageRequired: true,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("reference city selection", () => {
  test("single-city state resolves deterministically", () => {
    const campaign = cityCampaign();
    const options = listReferenceCityOptions({ campaign, stateCode: "CA" });
    expect(options).toHaveLength(1);
    expect(resolveDeterministicReferenceCitySlug({ campaign, stateCode: "CA", preferredCitySlug: null })).toBe("los-angeles");
  });

  test("multi-city state keeps state-constrained options and honors preferred city", () => {
    const campaign = cityCampaign();
    const options = listReferenceCityOptions({ campaign, stateCode: "TX" });
    expect(options.map((option) => option.citySlug)).toEqual(["austin", "houston"]);
    expect(resolveDeterministicReferenceCitySlug({ campaign, stateCode: "TX", preferredCitySlug: "houston" })).toBe("houston");
    expect(resolveDeterministicReferenceCitySlug({ campaign, stateCode: "TX", preferredCitySlug: "dallas" })).toBe("austin");
  });

  test("rejects cities not in campaign or mismatched state", () => {
    const campaign = cityCampaign();
    expect(resolveReferenceCityFromCampaign({ campaign, stateCode: "TX", citySlug: "dallas" })).toBeNull();
    expect(resolveReferenceCityFromCampaign({ campaign, stateCode: "CA", citySlug: "austin" })).toBeNull();
  });

  test("state campaigns expose no city options", () => {
    const campaign = { ...cityCampaign(), pageType: "state_service" as const, cityTargets: [] };
    expect(listReferenceCityOptions({ campaign, stateCode: "TX" })).toEqual([]);
    expect(resolveReferenceCityFromCampaign({ campaign, stateCode: "TX", citySlug: "austin" })).toBeNull();
  });
});
