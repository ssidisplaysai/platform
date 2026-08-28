import {
  createPageDimension,
  GLW_PRODUCT_CITY_BLUEPRINT,
  GLW_PRODUCT_PAGE_BLUEPRINT,
  GLW_PRODUCT_STATE_BLUEPRINT,
  INITIAL_GLW_PAGE_BLUEPRINTS,
  type PageBlueprint,
} from "@/modules/foundation/page-blueprint";
import {
  calculateTargetMatrixCardinality,
  buildTargetMatrixPreview,
  deduplicateMatrixTargets,
  listTargetMatrixTargets,
  materializeTargetMatrix,
  summarizeTargetMatrix,
} from "@/modules/foundation/target-matrix";
import {
  getTargetInventoryPersistenceReplacementCount,
  listTargetInventoryRecords,
  resetTargetInventoryRepositoryForTests,
  updateTargetInventoryMetadata,
  upsertTargetInventoryBatch,
} from "@/modules/foundation/target-inventory-repository";
import type {
  OperatorTargetSelection,
  ProductPlanningCandidate,
  ResolvedOperatorTargetSelection,
  VariantPlanningCandidate,
} from "@/modules/foundation/target-selection-resolution";
import {
  canonicalProductsToPlanningCandidates,
  resolveOperatorTargetSelection,
} from "@/modules/foundation/target-selection-resolution";
import { listCanonicalProducts } from "@/modules/foundation/product-repository";
import type { TargetGeographyCandidate } from "@/modules/foundation/target-inventory";

const SITE_ID = "site-led-display-warehouse-production";
const ORGANIZATION_ID = "led-display-warehouse";
const PLAN_FINGERPRINT = "5cdbe14dc73fd3d56f64488fad3f626308c41137da50eb6c921b6088691b0487";

const products: readonly ProductPlanningCandidate[] = [
  {
    productFamilyId: "family-standard-dvled",
    productId: "product-1",
    variantId: null,
    applicationProductSlug: "indoor-led-video-wall",
    canonicalProductSlug: "direct-view-led-video-walls",
    organizationId: ORGANIZATION_ID,
    siteIds: [SITE_ID],
    eligible: true,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  },
  {
    productFamilyId: "family-kiosks",
    productId: "product-2",
    variantId: null,
    applicationProductSlug: "outdoor-digital-kiosk",
    canonicalProductSlug: "digital-kiosks",
    organizationId: ORGANIZATION_ID,
    siteIds: [SITE_ID],
    eligible: true,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  },
  {
    productFamilyId: "family-oled",
    productId: "product-disabled",
    variantId: null,
    applicationProductSlug: "oled",
    canonicalProductSlug: "oled",
    organizationId: ORGANIZATION_ID,
    siteIds: [SITE_ID],
    eligible: false,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  },
];

const variants: readonly VariantPlanningCandidate[] = [
  { variantId: "variant-1", productId: "product-1", eligible: true, pageWorthy: true, reviewRequired: false, sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN" },
  { variantId: "variant-2", productId: "product-1", eligible: true, pageWorthy: true, reviewRequired: false, sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN" },
  { variantId: "variant-supporting", productId: "product-1", eligible: true, pageWorthy: false, reviewRequired: false, sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN" },
];

function selection(overrides: Partial<OperatorTargetSelection> = {}): OperatorTargetSelection {
  return {
    selectionId: "selection-002b",
    organizationId: ORGANIZATION_ID,
    siteId: SITE_ID,
    pageBlueprintIds: [GLW_PRODUCT_CITY_BLUEPRINT.pageBlueprintId],
    productSelection: { mode: "ONE", values: ["product-1"] },
    variantSelection: { mode: "ALL_ELIGIBLE", values: [] },
    stateSelection: { mode: "ONE", values: ["TX"] },
    citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "austin" }] },
    catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
    catalogRevisionId: null,
    reconciliationPlanFingerprint: PLAN_FINGERPRINT,
    createdBy: "operator-1",
    createdAt: "2026-08-27T00:00:00.000Z",
    selectionSource: "operator-target-matrix",
    notes: null,
    ...overrides,
  };
}

function resolve(
  overrides: Partial<OperatorTargetSelection> = {},
  candidateProducts = products,
  candidateVariants = variants,
  blueprints: readonly PageBlueprint[] = INITIAL_GLW_PAGE_BLUEPRINTS,
): ResolvedOperatorTargetSelection {
  return resolveOperatorTargetSelection({
    selection: selection(overrides),
    blueprints,
    products: candidateProducts,
    variants: candidateVariants,
  });
}

function variantCityBlueprint(version = 1): PageBlueprint {
  return {
    ...GLW_PRODUCT_CITY_BLUEPRINT,
    pageBlueprintId: "page-blueprint-product-variant-city",
    key: "GLW_PRODUCT_VARIANT_CITY",
    pageType: "PRODUCT_VARIANT_CITY",
    requiredDimensions: ["SITE", "PRODUCT", "VARIANT", "COUNTRY", "STATE", "CITY"],
    subjectScope: { ...GLW_PRODUCT_CITY_BLUEPRINT.subjectScope, variantPagesEnabled: true },
    version,
  };
}

function syntheticGeographies(count: number): TargetGeographyCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    countryCode: "US",
    stateCode: "TX",
    stateName: "Texas",
    stateSlug: "texas",
    cityName: `City ${index}`,
    citySlug: `city-${index}`,
    localityKey: `US|TX|city-${index}`,
  }));
}

function syntheticResolved(productCount: number, cityCount: number, blueprints: readonly PageBlueprint[] = [GLW_PRODUCT_CITY_BLUEPRINT]): ResolvedOperatorTargetSelection {
  const candidateProducts = Array.from({ length: productCount }, (_, index): ProductPlanningCandidate => ({
    ...products[0],
    productId: `synthetic-product-${index}`,
    applicationProductSlug: `application-product-${index}`,
    canonicalProductSlug: `canonical-product-${index}`,
  }));
  return {
    selection: selection({
      selectionId: `synthetic-${productCount}-${cityCount}`,
      pageBlueprintIds: blueprints.map((blueprint) => blueprint.pageBlueprintId),
      productSelection: { mode: "ALL_ELIGIBLE", values: [] },
      citySelection: { mode: "ALL_ELIGIBLE", values: [] },
    }),
    blueprints,
    products: candidateProducts,
    variants: [],
    states: [{ code: "TX", name: "Texas", slug: "texas" }],
    cities: syntheticGeographies(cityCount),
    filters: [],
    sourceProvenance: {
      catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
      catalogRevisionId: null,
      reconciliationPlanFingerprint: PLAN_FINGERPRINT,
      selectionSource: "synthetic-scale-test",
    },
  };
}

describe("002B operator selection resolution", () => {
  test("1. one product and one city resolve exactly", () => {
    const resolved = resolve();
    expect(resolved.products.map((product) => product.productId)).toEqual(["product-1"]);
    expect(resolved.cities.map((city) => city.localityKey)).toEqual(["US|TX|austin"]);
  });

  test("2. one product and all Texas cities resolve the certified inventory", () => {
    const resolved = resolve({ citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } });
    expect(resolved.cities.map((city) => city.citySlug)).toEqual(["austin", "dallas", "houston", "san-antonio"]);
  });

  test("3. multiple products and all Texas cities resolve independently", () => {
    const resolved = resolve({
      productSelection: { mode: "SELECTED", values: ["product-1", "product-2"] },
      citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] },
    });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(8);
  });

  test("4. duplicate selected product IDs collapse", () => {
    expect(resolve({ productSelection: { mode: "SELECTED", values: ["product-1", "product-1"] } }).products).toHaveLength(1);
  });

  test("5. unknown product ID fails closed", () => {
    expect(() => resolve({ productSelection: { mode: "ONE", values: ["unknown"] } })).toThrow("Unknown product ID");
  });

  test("6. all eligible products filters disabled products with reasons", () => {
    const resolved = resolve({ productSelection: { mode: "ALL_ELIGIBLE", values: [] } });
    expect(resolved.products.map((product) => product.productId)).toEqual(["product-1", "product-2"]);
    expect(resolved.filters).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "PRODUCT_NOT_ELIGIBLE", subjectId: "product-disabled" })]));
  });

  test("7. selected state resolves by exact code", () => {
    expect(resolve({ stateSelection: { mode: "SELECTED", values: ["TX"] } }).states[0].name).toBe("Texas");
  });

  test("8. unknown state fails closed", () => {
    expect(() => resolve({ stateSelection: { mode: "ONE", values: ["ZZ"] } })).toThrow("Unknown state ID");
  });

  test("9. selected city resolves by exact state and slug", () => {
    expect(resolve().cities[0]).toMatchObject({ stateCode: "TX", citySlug: "austin" });
  });

  test("10. cross-state city mismatch fails closed", () => {
    expect(() => resolve({ citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "los-angeles" }] } })).toThrow("does not belong to state TX");
  });

  test("11. city outside selected state fails closed", () => {
    expect(() => resolve({ citySelection: { mode: "ONE", values: [{ stateCode: "CA", citySlug: "los-angeles" }] } })).toThrow("outside the selected states");
  });

  test("12. multiple states expand only their own cities", () => {
    const resolved = resolve({
      stateSelection: { mode: "SELECTED", values: ["TX", "CA"] },
      citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] },
    });
    expect(resolved.cities.filter((city) => city.stateCode === "TX")).toHaveLength(4);
    expect(resolved.cities.filter((city) => city.stateCode === "CA")).toHaveLength(3);
  });

  test("13. explicit city plus all state cities preserves overlap for matrix dedup", () => {
    const resolved = resolve({ citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [{ stateCode: "TX", citySlug: "dallas" }] } });
    expect(resolved.cities.filter((city) => city.citySlug === "dallas")).toHaveLength(2);
  });

  test("14. blueprint selection is mandatory and explicit", () => {
    expect(() => resolve({ pageBlueprintIds: [] })).toThrow("Select at least one page blueprint");
  });

  test("15. catalog authorities cannot be mixed", () => {
    expect(() => resolve({}, [{ ...products[0], sourceAuthority: "CANONICAL_PERSISTED" }])).toThrow("cannot mix catalog authorities");
  });

  test("16. commercial price is not required for product planning", () => {
    expect(resolve().products[0]).not.toHaveProperty("price");
  });

  test("17. exact canonical products adapt to the same selection contract", () => {
    const canonical = canonicalProductsToPlanningCandidates({ products: listCanonicalProducts(), canonicalSlugByProductId: {} });
    expect(canonical).toHaveLength(6);
    expect(canonical.every((product) => product.sourceAuthority === "CANONICAL_PERSISTED")).toBe(true);
  });
});

describe("002B blueprint-specific matrix planning", () => {
  test("18. PRODUCT ignores city selections", () => {
    const resolved = resolve({ pageBlueprintIds: [GLW_PRODUCT_PAGE_BLUEPRINT.pageBlueprintId], citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(1);
  });

  test("19. PRODUCT_STATE ignores city count", () => {
    const resolved = resolve({ pageBlueprintIds: [GLW_PRODUCT_STATE_BLUEPRINT.pageBlueprintId], citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] } });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(1);
  });

  test("20. PRODUCT_CITY requires a resolved city", () => {
    const resolved = resolve();
    expect(() => buildTargetMatrixPreview({ resolved: { ...resolved, cities: [] } })).toThrow(/CITY/);
  });

  test("21. PRODUCT_VARIANT_CITY requires selected page-worthy variants", () => {
    const blueprint = variantCityBlueprint();
    const resolved = resolve({ pageBlueprintIds: [blueprint.pageBlueprintId], variantSelection: { mode: "SELECTED", values: ["variant-1", "variant-2"] } }, products, variants, [blueprint]);
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(2);
  });

  test("22. PRODUCT_CITY variant multiplier remains one", () => {
    const resolved = resolve({ variantSelection: { mode: "SELECTED", values: ["variant-1", "variant-2"] } });
    expect(buildTargetMatrixPreview({ resolved }).targets).toHaveLength(1);
  });

  test("23. multi-blueprint cardinality is summed by required dimensions", () => {
    const resolved = resolve({
      pageBlueprintIds: INITIAL_GLW_PAGE_BLUEPRINTS.map((blueprint) => blueprint.pageBlueprintId),
      productSelection: { mode: "SELECTED", values: ["product-1", "product-2"] },
      citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [] },
    });
    const cardinality = calculateTargetMatrixCardinality({ resolved });
    expect(cardinality.theoreticalTargetCount).toBe(12);
    expect(Object.values(cardinality.byBlueprint).sort((left, right) => left - right)).toEqual([2, 2, 8]);
  });

  test("24. family exclusions are filtered and reported", () => {
    const blueprint = { ...GLW_PRODUCT_CITY_BLUEPRINT, subjectScope: { ...GLW_PRODUCT_CITY_BLUEPRINT.subjectScope, allowedProductFamilyIds: ["family-kiosks"] } };
    const resolved = resolve({ pageBlueprintIds: [blueprint.pageBlueprintId] }, products, variants, [blueprint]);
    expect(() => buildTargetMatrixPreview({ resolved })).toThrow("requires resolved PRODUCT");
  });

  test("25. non-page-worthy variants are filtered with reasons", () => {
    const blueprint = variantCityBlueprint();
    const resolved = resolve({ pageBlueprintIds: [blueprint.pageBlueprintId], variantSelection: { mode: "ONE", values: ["variant-supporting"] } }, products, variants, [blueprint]);
    expect(resolved.filters).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "VARIANT_NOT_PAGE_WORTHY" })]));
    expect(() => buildTargetMatrixPreview({ resolved })).toThrow(/VARIANT/);
  });

  test("26. prohibited commercial dimensions fail closed", () => {
    expect(() => createPageDimension({ dimensionType: "CUSTOM", dimensionKey: "dealer-price", stableValue: "100", displayValue: "100", normalizedValue: "100" })).toThrow("Prohibited page dimension");
  });

  test("27. supporting-only dimensions do not enter PRODUCT_CITY targets", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve() });
    expect(matrix.targets[0].canonicalDimensions.some((dimension) => dimension.dimensionKey === "brightness")).toBe(false);
  });

  test("28. application and canonical paths remain distinct", () => {
    expect(buildTargetMatrixPreview({ resolved: resolve() }).targets[0]).toMatchObject({
      applicationPath: "indoor-led-video-wall/texas/austin",
      canonicalPath: "direct-view-led-video-walls/texas/austin",
    });
  });

  test("29. new targets remain planned and require preflight", () => {
    expect(buildTargetMatrixPreview({ resolved: resolve() }).targets[0]).toMatchObject({ targetState: "PLANNED", eligibility: "UNKNOWN_REQUIRES_PREFLIGHT" });
  });

  test("30. explicit plus all-state city overlap deduplicates after expansion", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve({ citySelection: { mode: "ALL_ELIGIBLE_IN_SELECTED_STATES", values: [{ stateCode: "TX", citySlug: "dallas" }] } }) });
    expect(matrix.summary).toMatchObject({ theoreticalTargetCount: 5, materializedBeforeDedupCount: 5, deduplicatedTargetCount: 4, duplicateTargetCount: 1 });
    expect(matrix.filters).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "DUPLICATE_TARGET" })]));
  });

  test("31. materially different payload under one target ID fails closed", () => {
    const target = buildTargetMatrixPreview({ resolved: resolve() }).targets[0];
    expect(() => deduplicateMatrixTargets([target, { ...target, canonicalPath: "different/path" }])).toThrow("materially different identity payloads");
  });

  test("32. operator preview contains bounded planning fields", () => {
    expect(buildTargetMatrixPreview({ resolved: resolve() }).previewRows[0]).toEqual(expect.objectContaining({
      targetId: expect.any(String),
      blueprintKey: "GLW_PRODUCT_CITY",
      productId: "product-1",
      cityName: "Austin",
      publicationIntent: "draft",
    }));
  });

  test("33. matrix list and summary read operations are pure", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve() });
    expect(listTargetMatrixTargets(matrix, { stateCode: "TX" })).toHaveLength(1);
    expect(summarizeTargetMatrix(matrix)).toBe(matrix.summary);
  });
});

describe("002B deterministic matrix identity", () => {
  test("34. identical semantic input yields identical fingerprint", () => {
    const first = buildTargetMatrixPreview({ resolved: resolve(), now: "2026-01-01T00:00:00.000Z" });
    const second = buildTargetMatrixPreview({ resolved: resolve(), now: "2027-01-01T00:00:00.000Z" });
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  test("35. product selection change changes fingerprint", () => {
    const first = buildTargetMatrixPreview({ resolved: resolve() });
    const second = buildTargetMatrixPreview({ resolved: resolve({ productSelection: { mode: "ONE", values: ["product-2"] } }) });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("36. geography change changes fingerprint", () => {
    const first = buildTargetMatrixPreview({ resolved: resolve() });
    const second = buildTargetMatrixPreview({ resolved: resolve({ citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "dallas" }] } }) });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("37. blueprint version change changes fingerprint", () => {
    const changed = { ...GLW_PRODUCT_CITY_BLUEPRINT, version: 2 };
    const first = buildTargetMatrixPreview({ resolved: resolve() });
    const second = buildTargetMatrixPreview({ resolved: resolve({}, products, variants, [changed]) });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("38. catalog reconciliation fingerprint change changes matrix fingerprint", () => {
    const first = buildTargetMatrixPreview({ resolved: resolve() });
    const second = buildTargetMatrixPreview({ resolved: resolve({ reconciliationPlanFingerprint: "different-plan" }) });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("39. matrix always retains draft intent without publication selection", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve() });
    expect(matrix.publicationIntent).toBe("draft");
    expect(matrix.selectionId).toBe("selection-002b");
    expect(matrix).not.toHaveProperty("publicationSelection");
  });
});

describe("002B cardinality and atomic materialization", () => {
  beforeEach(() => resetTargetInventoryRepositoryForTests());

  test.each([
    [25, 50, 1_250],
    [100, 100, 10_000],
    [175, 250, 43_750],
  ])("%i products x %i cities estimates %i before allocation", (productCount, cityCount, expected) => {
    expect(calculateTargetMatrixCardinality({ resolved: syntheticResolved(productCount, cityCount) }).theoreticalTargetCount).toBe(expected);
  });

  test("43. 175 products with city, product, and state blueprints estimates 44100", () => {
    expect(calculateTargetMatrixCardinality({ resolved: syntheticResolved(175, 250, INITIAL_GLW_PAGE_BLUEPRINTS) }).theoreticalTargetCount).toBe(44_100);
  });

  test("44. over-limit estimate fails before any persistence", () => {
    const resolved = syntheticResolved(401, 250);
    expect(() => materializeTargetMatrix({ resolved })).toThrow("exceeds limit 100000");
    expect(listTargetInventoryRecords()).toHaveLength(0);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(0);
  });

  test("45. preview-only returns exact targets without persistence", () => {
    expect(buildTargetMatrixPreview({ resolved: resolve() }).targets).toHaveLength(1);
    expect(listTargetInventoryRecords()).toHaveLength(0);
  });

  test("46. materialization persists exact inventory in one batch", () => {
    const result = materializeTargetMatrix({ resolved: resolve() });
    expect(result.persistence).toMatchObject({ createdCount: 1, reusedCount: 0 });
    expect(listTargetInventoryRecords()).toHaveLength(1);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(1);
  });

  test("47. existing target state and WordPress identity are preserved", () => {
    const first = materializeTargetMatrix({ resolved: resolve() });
    const target = first.matrix.targets[0];
    updateTargetInventoryMetadata({
      targetId: target.targetId,
      expectedTargetVersion: 1,
      patch: { targetState: "EXISTS_DRAFT", eligibility: "ELIGIBLE_UPDATE", wordpressObjectId: "3001" },
    });
    const preview = buildTargetMatrixPreview({ resolved: resolve(), existingTargets: listTargetInventoryRecords() });
    expect(preview.targets[0]).toMatchObject({ targetState: "EXISTS_DRAFT", eligibility: "ELIGIBLE_UPDATE", wordpressObjectId: "3001" });
  });

  test("48. 10000 targets persist with one full replacement", () => {
    const matrix = buildTargetMatrixPreview({ resolved: syntheticResolved(100, 100), now: "2026-08-27T00:00:00.000Z" });
    expect(matrix.targets).toHaveLength(10_000);
    const persisted = upsertTargetInventoryBatch({ targets: matrix.targets, expectedRepositoryRevision: 0 });
    expect(persisted.createdCount).toBe(10_000);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(1);
  }, 30_000);

  test("49. batch identity conflict is atomic", () => {
    const target = buildTargetMatrixPreview({ resolved: resolve() }).targets[0];
    expect(() => upsertTargetInventoryBatch({ targets: [target, { ...target, canonicalPath: "different/path" }] })).toThrow("conflicts with its immutable persisted identity");
    expect(listTargetInventoryRecords()).toHaveLength(0);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(0);
  });

  test("50. matrix records contain no generation, n8n, or WordPress read authority", () => {
    const matrix = buildTargetMatrixPreview({ resolved: resolve() }) as unknown as Record<string, unknown>;
    expect(matrix).not.toHaveProperty("generationRequest");
    expect(matrix).not.toHaveProperty("n8nExecution");
    expect(matrix).not.toHaveProperty("wordpressRead");
  });
});