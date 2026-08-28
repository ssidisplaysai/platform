import {
  GLW_CITIES,
  GLW_STATES,
  assertGlwGeographyAuthority,
  validateGlwGeographyAuthority,
  type GlwCity,
} from "@/modules/glw/page-generation";
import {
  GLW_WORDPRESS_STATE_HIERARCHY,
  getGlwWordPressStateHierarchy,
  requireGlwWordPressStateHierarchy,
} from "@/modules/glw/wordpress-state-hierarchy";
import {
  GLW_PRODUCT_CITY_BLUEPRINT,
  GLW_PRODUCT_STATE_BLUEPRINT,
} from "@/modules/foundation/page-blueprint";
import {
  buildTargetMatrixPreview,
  calculateTargetMatrixCardinality,
} from "@/modules/foundation/target-matrix";
import {
  resolveOperatorTargetSelection,
  type OperatorTargetSelection,
  type ProductPlanningCandidate,
  type ResolvedOperatorTargetSelection,
} from "@/modules/foundation/target-selection-resolution";

const SITE_ID = "site-led-display-warehouse-production";
const PRODUCT_ID = "prod-indoor-led-video-wall";
const PLAN_FINGERPRINT = "5cdbe14dc73fd3d56f64488fad3f626308c41137da50eb6c921b6088691b0487";
const EXISTING = ["atlanta", "austin", "charlotte", "chicago", "dallas", "houston", "los-angeles", "miami", "new-york", "orlando", "san-antonio", "san-diego", "san-francisco"];

function product(index = 1): ProductPlanningCandidate {
  return {
    productFamilyId: "family-standard-dvled",
    productId: `${PRODUCT_ID}-${index}`,
    productName: `Indoor LED Video Wall ${index}`,
    variantId: null,
    applicationProductSlug: `indoor-led-video-wall-${index}`,
    canonicalProductSlug: `direct-view-led-video-walls-${index}`,
    organizationId: "led-display-warehouse",
    siteIds: [SITE_ID],
    eligible: true,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  };
}

function selection(overrides: Partial<OperatorTargetSelection> = {}): OperatorTargetSelection {
  return {
    selectionId: "geography-authority",
    organizationId: "led-display-warehouse",
    siteId: SITE_ID,
    pageBlueprintIds: [GLW_PRODUCT_CITY_BLUEPRINT.pageBlueprintId],
    productSelection: { mode: "ONE", values: [`${PRODUCT_ID}-1`] },
    variantSelection: { mode: "ALL_ELIGIBLE", values: [] },
    stateSelection: { mode: "ONE", values: ["TX"] },
    citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "fort-worth" }] },
    catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
    catalogRevisionId: null,
    reconciliationPlanFingerprint: PLAN_FINGERPRINT,
    createdBy: "geography-certifier",
    createdAt: "2030-01-01T00:00:00.000Z",
    selectionSource: "geography-authority-test",
    notes: null,
    ...overrides,
  };
}

function resolve(input: {
  selection?: Partial<OperatorTargetSelection>;
  products?: readonly ProductPlanningCandidate[];
  blueprints?: ResolvedOperatorTargetSelection["blueprints"];
} = {}): ResolvedOperatorTargetSelection {
  return resolveOperatorTargetSelection({
    selection: selection(input.selection),
    blueprints: input.blueprints ?? [GLW_PRODUCT_CITY_BLUEPRINT],
    products: input.products ?? [product()],
    variants: [],
  });
}

describe("002E.3A.1 certified geography authority", () => {
  test("1. preserves all existing 13 city slugs", () => {
    expect(EXISTING.every((slug) => GLW_CITIES.some((city) => city.slug === slug))).toBe(true);
  });

  test("2. expands to the certified 75-city baseline", () => {
    expect(GLW_CITIES).toHaveLength(75);
    expect(validateGlwGeographyAuthority()).toEqual({ valid: true, duplicateCityIdentityCount: 0, cityWithoutValidStateCount: 0, cityWithMultipleStateOwnerCount: 0 });
  });

  test("3. city locality identity is deterministic by state and slug", () => {
    expect(resolve().cities[0].localityKey).toBe("US|TX|fort-worth");
    expect(resolve().cities[0].localityKey).toBe(resolve().cities[0].localityKey);
  });

  test.each([["Fort Worth", "fort-worth"], ["San Jose", "san-jose"], ["St. Petersburg", "st-petersburg"]])("4. preserves existing slug policy for %s", (name, slug) => {
    expect(GLW_CITIES).toContainEqual(expect.objectContaining({ name, slug }));
  });

  test("5. duplicate state and slug identity is rejected", () => {
    const duplicate: GlwCity[] = [...GLW_CITIES, { ...GLW_CITIES[0], name: "Other Austin" }];
    expect(() => assertGlwGeographyAuthority({ cities: duplicate })).toThrow("duplicate=1");
  });

  test("6. same display name in different states remains distinct", () => {
    const cities: GlwCity[] = [{ stateCode: "TX", name: "Springfield", slug: "springfield", metro: "A" }, { stateCode: "IL", name: "Springfield", slug: "springfield", metro: "B" }];
    expect(validateGlwGeographyAuthority({ cities }).valid).toBe(true);
  });

  test("7. unknown state is rejected", () => {
    expect(() => resolve({ selection: { stateSelection: { mode: "ONE", values: ["ZZ"] } } })).toThrow("Unknown state ID");
  });

  test("8. cross-state city selection is rejected", () => {
    expect(() => resolve({ selection: { citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "san-jose" }] } } })).toThrow("does not belong to state TX");
  });

  test("9. selected city resolves by exact state and slug", () => {
    expect(resolve().cities).toEqual([expect.objectContaining({ stateCode: "TX", citySlug: "fort-worth", cityName: "Fort Worth" })]);
  });

  test("10. all cities in all selected states expand deterministically", () => {
    const resolved = resolve({ selection: { stateSelection: { mode: "ALL_ELIGIBLE", values: [] }, citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } } });
    expect(resolved.cities).toHaveLength(75);
    expect(resolved.cities.map((city) => city.localityKey)).toEqual([...resolved.cities.map((city) => city.localityKey)].sort());
  });

  test.each([["TX", 15], ["CA", 15], ["FL", 10]])("11-13. expands %s to %i cities", (stateCode, count) => {
    const resolved = resolve({ selection: { stateSelection: { mode: "ONE", values: [stateCode] }, citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } } });
    expect(resolved.cities).toHaveLength(count);
  });

  test("14. exact state parent mapping covers all seven states", () => {
    expect(GLW_WORDPRESS_STATE_HIERARCHY).toHaveLength(7);
    expect(GLW_WORDPRESS_STATE_HIERARCHY.map((entry) => [entry.stateCode, entry.wordpressStatePageId])).toEqual(expect.arrayContaining([["TX", "2563"], ["CA", "3315"], ["FL", "3344"], ["GA", "3345"], ["IL", "3373"], ["NY", "3495"], ["NC", "3496"]]));
    expect(GLW_WORDPRESS_STATE_HIERARCHY.every((entry) => entry.wordpressProductParentId === "124" && entry.wordpressStatus === "publish")).toBe(true);
  });

  test("15. missing site/product/state parent mapping is blocked", () => {
    expect(getGlwWordPressStateHierarchy({ siteId: SITE_ID, productId: PRODUCT_ID, stateCode: "ZZ" })).toBeNull();
    expect(() => requireGlwWordPressStateHierarchy({ siteId: SITE_ID, productId: PRODUCT_ID, stateCode: "ZZ" })).toThrow("not certified");
  });

  test("16. target matrix expands a newly certified city", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve() });
    expect(matrix.targets).toHaveLength(1);
    expect(matrix.targets[0]).toMatchObject({ canonicalSlug: "fort-worth", geography: { stateCode: "TX", cityKey: "US|TX|fort-worth" } });
  });

  test("17. matrix deduplication remains stable with explicit and all-state overlap", () => {
    const resolved = resolve({ selection: { citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [{ stateCode: "TX", citySlug: "fort-worth" }] } } });
    expect(buildTargetMatrixPreview({ resolved }).summary).toMatchObject({ materializedBeforeDedupCount: 16, deduplicatedTargetCount: 15, duplicateTargetCount: 1 });
  });

  test("18. expanded cardinality is exact for 1, 10, and 175 products", () => {
    const allCities = resolve({ selection: { stateSelection: { mode: "ALL_ELIGIBLE", values: [] }, citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } } });
    expect(calculateTargetMatrixCardinality({ resolved: allCities }).theoreticalTargetCount).toBe(75);
    expect(calculateTargetMatrixCardinality({ resolved: { ...allCities, products: Array.from({ length: 10 }, (_, index) => product(index + 1)) } }).theoreticalTargetCount).toBe(750);
    expect(calculateTargetMatrixCardinality({ resolved: { ...allCities, products: Array.from({ length: 175 }, (_, index) => product(index + 1)) } }).theoreticalTargetCount).toBe(13_125);
  });

  test("19. 100000 target preview limit still fails closed", () => {
    const allCities = resolve({ selection: { stateSelection: { mode: "ALL_ELIGIBLE", values: [] }, citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } } });
    const oversized = { ...allCities, products: Array.from({ length: 1_334 }, (_, index) => product(index + 1)) };
    expect(calculateTargetMatrixCardinality({ resolved: oversized }).overLimit).toBe(true);
    expect(() => buildTargetMatrixPreview({ resolved: oversized })).toThrow("exceeds limit 100000");
  });

  test("20. one city is reusable across different product identities", () => {
    const resolved = resolve({ selection: { productSelection: { mode: "ALL_ELIGIBLE", values: [] } }, products: [product(1), product(2)] });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(2);
  });

  test("21. one city is reusable across different blueprint identities", () => {
    const second = { ...GLW_PRODUCT_CITY_BLUEPRINT, pageBlueprintId: "page-blueprint-second-city", key: "GLW_PRODUCT_CITY_SECOND" };
    const resolved = resolve({ selection: { pageBlueprintIds: [GLW_PRODUCT_CITY_BLUEPRINT.pageBlueprintId, second.pageBlueprintId] }, blueprints: [GLW_PRODUCT_CITY_BLUEPRINT, second] });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(2);
  });

  test("22. geography identity remains separate from site-specific hierarchy", () => {
    const city = GLW_CITIES.find((entry) => entry.stateCode === "TX" && entry.slug === "fort-worth")!;
    expect(city).not.toHaveProperty("wordpressStatePageId");
    expect(requireGlwWordPressStateHierarchy({ siteId: SITE_ID, productId: PRODUCT_ID, stateCode: "TX" }).wordpressStatePageId).toBe("2563");
  });

  test("23. existing ramp geography ownership remains unchanged", () => {
    expect(EXISTING.map((slug) => GLW_CITIES.find((city) => city.slug === slug)?.stateCode)).toEqual(["GA", "TX", "NC", "IL", "TX", "TX", "CA", "FL", "NY", "FL", "TX", "CA", "CA"]);
  });

  test("24. at least 25 unused certified city contexts are available", () => {
    expect(GLW_CITIES.filter((city) => !EXISTING.includes(city.slug))).toHaveLength(62);
  });

  test("state blueprint remains independent of city registry size", () => {
    const resolved = resolve({ selection: { pageBlueprintIds: [GLW_PRODUCT_STATE_BLUEPRINT.pageBlueprintId] }, blueprints: [GLW_PRODUCT_STATE_BLUEPRINT] });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(1);
  });

  test("every certified city belongs to exactly one canonical state", () => {
    expect(GLW_CITIES.filter((city) => !GLW_STATES.some((state) => state.code === city.stateCode))).toHaveLength(0);
  });
});