import {
  createCityIdentityKey,
  resolveGlwCampaignGeography,
} from "@/modules/glw/campaign-targeting";

describe("campaign-targeting", () => {
  test("resolves all states to 50 deterministic state targets", () => {
    const resolved = resolveGlwCampaignGeography({
      mode: "ALL_STATES",
      selectedStateCodes: [],
      selectedCityIdentities: [],
      citiesByStateScope: "ALL_SUPPORTED",
    });

    expect(resolved.pageType).toBe("state_service");
    expect(resolved.targetType).toBe("STATE");
    expect(resolved.targets).toHaveLength(50);
    expect(resolved.stateCodes).toHaveLength(50);
  });

  test("resolves selected states exactly and uniquely", () => {
    const resolved = resolveGlwCampaignGeography({
      mode: "SELECTED_STATES",
      selectedStateCodes: ["tx", "mi", "TX", "de"],
      selectedCityIdentities: [],
      citiesByStateScope: "ALL_SUPPORTED",
    });

    expect(resolved.targetType).toBe("STATE");
    expect(resolved.stateCodes).toEqual(["DE", "MI", "TX"]);
    expect(resolved.targets.map((target) => target.identity)).toEqual(["DE", "MI", "TX"]);
  });

  test("resolves the provided 30-state subset without hardcoding", () => {
    const subset = ["DE", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
    const resolved = resolveGlwCampaignGeography({
      mode: "SELECTED_STATES",
      selectedStateCodes: subset,
      selectedCityIdentities: [],
      citiesByStateScope: "ALL_SUPPORTED",
    });

    expect(resolved.targetType).toBe("STATE");
    expect(resolved.stateCodes).toHaveLength(30);
    expect(resolved.targets).toHaveLength(30);
  });

  test("resolves all supported cities for selected states", () => {
    const resolved = resolveGlwCampaignGeography({
      mode: "CITIES_BY_STATE",
      selectedStateCodes: ["TX"],
      selectedCityIdentities: [],
      citiesByStateScope: "ALL_SUPPORTED",
    });

    expect(resolved.pageType).toBe("city_service");
    expect(resolved.targetType).toBe("CITY");
    expect(resolved.stateCodes).toEqual(["TX"]);
    expect(resolved.cityTargets).toHaveLength(15);
    expect(resolved.targets[0]).toMatchObject({ targetType: "CITY", stateCode: "TX" });
  });

  test("resolves selected cities with canonical state+slug identity and dedupe", () => {
    const austin = createCityIdentityKey({ stateCode: "TX", citySlug: "austin" });
    const miami = createCityIdentityKey({ stateCode: "FL", citySlug: "miami" });
    const resolved = resolveGlwCampaignGeography({
      mode: "SELECTED_CITIES",
      selectedStateCodes: [],
      selectedCityIdentities: [austin, miami, austin],
      citiesByStateScope: "SELECTED",
    });

    expect(resolved.stateCodes).toEqual(["FL", "TX"]);
    expect(resolved.cityTargets).toEqual([
      { stateCode: "FL", citySlug: "miami", cityName: "Miami" },
      { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
    ]);
    expect(new Set(resolved.targets.map((target) => target.identity)).size).toBe(resolved.targets.length);
  });

  test("filters CITIES_BY_STATE selected-city scope to selected states", () => {
    const austin = createCityIdentityKey({ stateCode: "TX", citySlug: "austin" });
    const miami = createCityIdentityKey({ stateCode: "FL", citySlug: "miami" });
    const resolved = resolveGlwCampaignGeography({
      mode: "CITIES_BY_STATE",
      selectedStateCodes: ["TX"],
      selectedCityIdentities: [austin, miami],
      citiesByStateScope: "SELECTED",
    });

    expect(resolved.stateCodes).toEqual(["TX"]);
    expect(resolved.cityTargets).toEqual([
      { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
    ]);
  });
});