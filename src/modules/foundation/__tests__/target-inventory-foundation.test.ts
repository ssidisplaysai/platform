import type { GlwTargetPreflightResult } from "@/modules/glw/target-preflight";
import {
  createPageBlueprintId,
  createPageDimension,
  GLW_PRODUCT_CITY_BLUEPRINT,
  GLW_PRODUCT_PAGE_BLUEPRINT,
  INITIAL_GLW_PAGE_BLUEPRINTS,
  type PageBlueprint,
  type PageDimension,
  validatePageBlueprintDimensions,
} from "@/modules/foundation/page-blueprint";
import {
  createTargetId,
  createTargetIdentity,
  detectTargetStaleness,
  estimateTargetCardinality,
  expandTargetInventoryPreview,
  projectGlwPreflightToTarget,
  summarizeTargetInventory,
  TARGET_EXPANSION_LIMITS,
  TargetPlanningError,
  type TargetGeographyCandidate,
  type TargetInventoryRecord,
  type TargetSelectionScope,
  type TargetSourceProvenance,
  type TargetSubjectCandidate,
} from "@/modules/foundation/target-inventory";
import {
  createTargetInventoryRecord as persistTarget,
  getTargetInventoryRecord,
  getTargetInventoryPersistenceReplacementCount,
  getTargetInventoryRepositoryRevision,
  listTargetInventoryRecords,
  resetTargetInventoryRepositoryForTests,
  TargetInventoryRepositoryError,
  updateTargetInventoryMetadata,
  upsertTargetInventoryBatch,
} from "@/modules/foundation/target-inventory-repository";

const planProvenance: TargetSourceProvenance = {
  catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  catalogRevisionId: null,
  reconciliationPlanFingerprint: "5cdbe14dc73fd3d56f64488fad3f626308c41137da50eb6c921b6088691b0487",
  selectionSource: "002a-test-selection",
};

const canonicalProvenance: TargetSourceProvenance = {
  catalogAuthority: "CANONICAL_PERSISTED",
  catalogRevisionId: "catalog-revision-7",
  reconciliationPlanFingerprint: null,
  selectionSource: "002a-canonical-selection",
};

const indoorWall: TargetSubjectCandidate = {
  productFamilyId: "family-standard-dvled",
  productId: "prod-indoor-led-video-wall",
  variantId: null,
  applicationProductSlug: "indoor-led-video-wall",
  canonicalProductSlug: "direct-view-led-video-walls",
};

const outdoorWall: TargetSubjectCandidate = {
  ...indoorWall,
  productId: "prod-outdoor-led-video-wall",
  applicationProductSlug: "outdoor-led-video-wall",
};

const austin: TargetGeographyCandidate = {
  countryCode: "US",
  stateCode: "TX",
  stateName: "Texas",
  stateSlug: "texas",
  cityName: "Austin",
  citySlug: "austin",
  localityKey: "US|TX|austin",
};

const dallas: TargetGeographyCandidate = {
  ...austin,
  cityName: "Dallas",
  citySlug: "dallas",
  localityKey: "US|TX|dallas",
};

function dimension(
  dimensionType: PageDimension["dimensionType"],
  dimensionKey: string,
  stableValue: string,
  displayValue = stableValue,
): PageDimension {
  return createPageDimension({
    dimensionType,
    dimensionKey,
    stableValue,
    displayValue,
    normalizedValue: stableValue,
  });
}

function cityDimensions(city = austin, subject = indoorWall): PageDimension[] {
  return [
    dimension("SITE", "site-id", GLW_PRODUCT_CITY_BLUEPRINT.siteId),
    dimension("PRODUCT", "product-id", subject.productId),
    dimension("COUNTRY", "country-code", city.countryCode),
    dimension("STATE", "state-code", city.stateCode ?? ""),
    dimension("CITY", "city-key", city.localityKey ?? "", city.cityName ?? ""),
  ];
}

function cityTarget(city = austin, subject = indoorWall): TargetInventoryRecord {
  return expandTargetInventoryPreview({
    blueprint: GLW_PRODUCT_CITY_BLUEPRINT,
    subjects: [subject],
    geographies: [city],
    sourceProvenance: planProvenance,
    now: "2026-08-27T00:00:00.000Z",
  })[0];
}

function preflight(
  target: TargetInventoryRecord,
  state: GlwTargetPreflightResult["state"],
  wordpressObjectId: string | null = null,
): GlwTargetPreflightResult {
  return {
    applicationPath: target.applicationPath,
    canonicalPath: target.canonicalPath,
    canonicalProduct: "Direct View LED Video Walls",
    canonicalProductSlug: "direct-view-led-video-walls",
    canonicalSlug: target.canonicalSlug,
    canonicalParentId: "2563",
    state,
    wordpressObjectId,
    wordpressStatus: state === "EXISTS_DRAFT" ? "draft" : state === "EXISTS_PUBLISHED" ? "publish" : null,
    wordpressTitle: null,
    wordpressUrl: wordpressObjectId ? `https://example.test/?page_id=${wordpressObjectId}` : null,
    source: state === "UNKNOWN" ? "UNVERIFIED" : "WORDPRESS_READ",
    confidence: state === "UNKNOWN" ? "UNVERIFIED" : "AUTHORITATIVE",
  };
}

function attributeBlueprint(attributePagesEnabled: boolean): PageBlueprint {
  return {
    ...GLW_PRODUCT_PAGE_BLUEPRINT,
    pageBlueprintId: "page-blueprint-attribute-test",
    key: "ATTRIBUTE_TEST",
    pageType: "ATTRIBUTE",
    subjectScope: {
      ...GLW_PRODUCT_PAGE_BLUEPRINT.subjectScope,
      attributePagesEnabled,
    },
    requiredDimensions: ["SITE", "PRODUCT", "ATTRIBUTE", "ATTRIBUTE_VALUE"],
    optionalDimensions: [],
  };
}

describe("002A page blueprint foundation", () => {
  test("1. PageBlueprint identity is stable", () => {
    const input = { organizationId: "org", siteId: "site", key: "PRODUCT_CITY" };
    expect(createPageBlueprintId(input)).toBe(createPageBlueprintId(input));
  });

  test("2. blueprint version is retained", () => {
    expect(GLW_PRODUCT_CITY_BLUEPRINT.version).toBe(1);
    expect(cityTarget().blueprintVersion).toBe(1);
  });

  test("3. PRODUCT_CITY requires product, country, state, and city", () => {
    const validation = validatePageBlueprintDimensions(GLW_PRODUCT_CITY_BLUEPRINT, [
      dimension("SITE", "site-id", GLW_PRODUCT_CITY_BLUEPRINT.siteId),
      dimension("PRODUCT", "product-id", indoorWall.productId),
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.missingDimensions).toEqual(["COUNTRY", "STATE", "CITY"]);
  });

  test("4. PRODUCT does not require geography", () => {
    const targets = expandTargetInventoryPreview({
      blueprint: GLW_PRODUCT_PAGE_BLUEPRINT,
      subjects: [indoorWall],
      geographies: [],
      sourceProvenance: planProvenance,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].geography).toMatchObject({ countryCode: null, stateCode: null, cityKey: null });
  });

  test("5. initial GLW blueprints are planning-only and draft-only", () => {
    expect(INITIAL_GLW_PAGE_BLUEPRINTS.map((blueprint) => blueprint.key)).toEqual([
      "GLW_PRODUCT_PAGE",
      "GLW_PRODUCT_STATE",
      "GLW_PRODUCT_CITY",
    ]);
    expect(INITIAL_GLW_PAGE_BLUEPRINTS.every((blueprint) =>
      blueprint.publicationPolicy.mode === "DRAFT_ONLY"
      && blueprint.publicationPolicy.automaticPublication === false)).toBe(true);
  });

  test.each(["price", "dealer price", "distributor_price", "retail-price", "shipping cost", "tariff"])(
    "commercial dimension %s is prohibited",
    (key) => {
      expect(() => createPageDimension({
        dimensionType: "CUSTOM",
        dimensionKey: key,
        stableValue: "100",
        displayValue: "100",
        normalizedValue: "100",
        worthiness: "PAGE_WORTHY",
      })).toThrow(`Prohibited page dimension: ${key}`);
    },
  );

  test("12. supporting-only brightness cannot create an attribute target", () => {
    const blueprint = attributeBlueprint(true);
    const dimensions = [
      dimension("SITE", "site-id", blueprint.siteId),
      dimension("PRODUCT", "product-id", indoorWall.productId),
      dimension("ATTRIBUTE", "brightness", "attribute-brightness"),
      dimension("ATTRIBUTE_VALUE", "brightness", "1000-nits"),
    ];
    expect(() => createTargetIdentity({ blueprint, dimensions })).toThrow(TargetPlanningError);
  });

  test("13. page-worthy conditional attribute requires blueprint authorization", () => {
    const denied = attributeBlueprint(false);
    const dimensions = [
      dimension("SITE", "site-id", denied.siteId),
      dimension("PRODUCT", "product-id", indoorWall.productId),
      dimension("ATTRIBUTE", "pixel-pitch", "attribute-pixel-pitch"),
      dimension("ATTRIBUTE_VALUE", "pixel-pitch", "p1.5"),
    ];
    expect(() => createTargetIdentity({ blueprint: denied, dimensions })).toThrow(TargetPlanningError);
    expect(createTargetIdentity({ blueprint: attributeBlueprint(true), dimensions }).canonicalDimensions).toHaveLength(4);
  });
});

describe("002A deterministic target identity and preflight projection", () => {
  test("14. target identity is deterministic", () => {
    const identity = createTargetIdentity({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, dimensions: cityDimensions() });
    expect(createTargetId(identity)).toBe(createTargetId(identity));
  });

  test("15. dimension ordering does not affect target ID", () => {
    const dimensions = cityDimensions();
    const forward = createTargetIdentity({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, dimensions });
    const reverse = createTargetIdentity({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, dimensions: [...dimensions].reverse() });
    expect(createTargetId(reverse)).toBe(createTargetId(forward));
  });

  test("16. different city creates a different target", () => {
    expect(cityTarget(dallas).targetId).not.toBe(cityTarget(austin).targetId);
  });

  test("17. different product creates a different target", () => {
    expect(cityTarget(austin, outdoorWall).targetId).not.toBe(cityTarget(austin, indoorWall).targetId);
  });

  test("18. different blueprint creates a different target", () => {
    const product = expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_PAGE_BLUEPRINT, subjects: [indoorWall], geographies: [], sourceProvenance: planProvenance })[0];
    expect(product.targetId).not.toBe(cityTarget().targetId);
  });

  test("19. different variant changes target identity for a variant blueprint", () => {
    const blueprint: PageBlueprint = {
      ...GLW_PRODUCT_PAGE_BLUEPRINT,
      pageBlueprintId: "page-blueprint-variant",
      pageType: "PRODUCT_VARIANT",
      requiredDimensions: ["SITE", "PRODUCT", "VARIANT"],
      subjectScope: { ...GLW_PRODUCT_PAGE_BLUEPRINT.subjectScope, variantPagesEnabled: true },
    };
    const first = expandTargetInventoryPreview({ blueprint, subjects: [{ ...indoorWall, variantId: "variant-1" }], geographies: [], sourceProvenance: planProvenance })[0];
    const second = expandTargetInventoryPreview({ blueprint, subjects: [{ ...indoorWall, variantId: "variant-2" }], geographies: [], sourceProvenance: planProvenance })[0];
    expect(first.targetId).not.toBe(second.targetId);
  });

  test("20. variant does not affect PRODUCT_CITY when the blueprint excludes it", () => {
    const base = cityTarget(austin, indoorWall);
    const withVariant = cityTarget(austin, { ...indoorWall, variantId: "variant-1" });
    expect(withVariant.targetId).toBe(base.targetId);
    expect(withVariant.subject.variantId).toBeNull();
  });

  test("materialized variant subjects are not multiplied twice during expansion", () => {
    const blueprint: PageBlueprint = {
      ...GLW_PRODUCT_PAGE_BLUEPRINT,
      pageBlueprintId: "page-blueprint-variant-expansion",
      pageType: "PRODUCT_VARIANT",
      requiredDimensions: ["SITE", "PRODUCT", "VARIANT"],
      subjectScope: { ...GLW_PRODUCT_PAGE_BLUEPRINT.subjectScope, variantPagesEnabled: true },
    };
    const targets = expandTargetInventoryPreview({
      blueprint,
      subjects: [{ ...indoorWall, variantId: "variant-1" }, { ...indoorWall, variantId: "variant-2" }],
      geographies: [],
      sourceProvenance: planProvenance,
      maximumTargets: 2,
    });
    expect(targets).toHaveLength(2);
  });

  test("21. application and canonical paths can differ for Dallas", () => {
    const target = cityTarget(dallas);
    expect(target).toMatchObject({
      applicationPath: "indoor-led-video-wall/texas/dallas",
      canonicalPath: "direct-view-led-video-walls/texas/dallas",
    });
  });

  test("22. target identity exists before a WordPress object", () => {
    expect(cityTarget()).toMatchObject({ wordpressObjectId: null, targetState: "PLANNED" });
  });

  test("23. target identity contains no execution or job ID", () => {
    const target = cityTarget() as unknown as Record<string, unknown>;
    expect(target.executionId).toBeUndefined();
    expect(target.jobId).toBeUndefined();
    expect(JSON.stringify(target.identity)).not.toContain("execution");
  });

  test("24. identity-bearing dimension change creates a new identity", () => {
    const before = cityTarget(austin);
    const after = cityTarget(dallas);
    expect(after.targetId).not.toBe(before.targetId);
  });

  test("25. conflicting stable values for one dimension fail closed", () => {
    expect(() => createTargetIdentity({
      blueprint: GLW_PRODUCT_CITY_BLUEPRINT,
      dimensions: [...cityDimensions(), dimension("CITY", "city-key", "US|TX|dallas")],
    })).toThrow("Conflicting target dimension");
  });

  test("26. exact draft WordPress ID attaches as update eligibility", () => {
    expect(projectGlwPreflightToTarget(cityTarget(), preflight(cityTarget(), "EXISTS_DRAFT", "3001"))).toMatchObject({
      targetState: "EXISTS_DRAFT",
      eligibility: "ELIGIBLE_UPDATE",
      wordpressObjectId: "3001",
    });
  });

  test("27. published target is not update eligible", () => {
    expect(projectGlwPreflightToTarget(cityTarget(), preflight(cityTarget(), "EXISTS_PUBLISHED", "18846")).eligibility)
      .toBe("NOT_ELIGIBLE_PUBLISHED");
  });

  test("28. UNKNOWN never becomes create eligible", () => {
    expect(projectGlwPreflightToTarget(cityTarget(), preflight(cityTarget(), "UNKNOWN")).eligibility)
      .toBe("UNKNOWN_REQUIRES_PREFLIGHT");
  });

  test("29. exact absent target becomes create eligible", () => {
    expect(projectGlwPreflightToTarget(cityTarget(), preflight(cityTarget(), "ABSENT")).eligibility)
      .toBe("ELIGIBLE_CREATE");
  });

  test("30. mismatched preflight paths fail closed", () => {
    const target = cityTarget();
    expect(() => projectGlwPreflightToTarget(target, { ...preflight(target, "ABSENT"), canonicalPath: "wrong/path" }))
      .toThrow("Preflight paths do not exactly match");
  });
});

describe("002A bounded expansion and selection", () => {
  test("31. one product and one city expands to one target", () => {
    expect(expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, subjects: [indoorWall], geographies: [austin], sourceProvenance: planProvenance })).toHaveLength(1);
  });

  test("32. one product and selected cities expands correctly", () => {
    expect(expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, subjects: [indoorWall], geographies: [austin, dallas], sourceProvenance: planProvenance })).toHaveLength(2);
  });

  test("33. many products and many cities expand as a Cartesian preview", () => {
    expect(expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, subjects: [indoorWall, outdoorWall], geographies: [austin, dallas], sourceProvenance: planProvenance })).toHaveLength(4);
  });

  test("34. equivalent duplicate selections collapse by target ID", () => {
    expect(expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, subjects: [indoorWall], geographies: [austin, { ...austin }], sourceProvenance: planProvenance })).toHaveLength(1);
  });

  test("35. over-limit expansion fails before target instantiation", () => {
    expect(() => expandTargetInventoryPreview({
      blueprint: GLW_PRODUCT_CITY_BLUEPRINT,
      subjects: [indoorWall, outdoorWall],
      geographies: [austin, dallas],
      sourceProvenance: planProvenance,
      maximumTargets: 3,
    })).toThrow("Target expansion exceeds");
  });

  test("36. variant existence does not multiply PRODUCT_CITY cardinality", () => {
    expect(estimateTargetCardinality({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, productCount: 3, variantCount: 511, geographyCount: 10 }).theoreticalTargetCount).toBe(30);
  });

  test.each([
    [25, 50, 1_250],
    [100, 100, 10_000],
    [175, 250, 43_750],
  ])("cardinality %i products x %i cities is %i", (productCount, geographyCount, expected) => {
    expect(estimateTargetCardinality({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, productCount, geographyCount }).theoreticalTargetCount).toBe(expected);
  });

  test("40. planning limits expose a useful 100000-target preview bound", () => {
    expect(TARGET_EXPANSION_LIMITS.maximumTargetsPerPreview).toBe(100_000);
  });

  test("41. ONE, SELECTED, and ALL_ELIGIBLE selection modes support future matrix resolution", () => {
    const selection: TargetSelectionScope = {
      products: { mode: "ALL_ELIGIBLE", values: [] },
      variants: { mode: "SELECTED", values: ["variant-1"] },
      states: { mode: "ONE", values: ["TX"] },
      cities: { mode: "ALL_ELIGIBLE", values: [] },
    };
    expect(selection).toMatchObject({
      products: { mode: "ALL_ELIGIBLE" },
      cities: { mode: "ALL_ELIGIBLE" },
    });
  });

  test("42. certified reconciliation-plan provenance remains explicit", () => {
    expect(cityTarget().sourceProvenance).toEqual(planProvenance);
  });

  test("43. canonical persisted catalog provenance remains explicit", () => {
    const target = expandTargetInventoryPreview({ blueprint: GLW_PRODUCT_CITY_BLUEPRINT, subjects: [indoorWall], geographies: [austin], sourceProvenance: canonicalProvenance })[0];
    expect(target.sourceProvenance).toEqual(canonicalProvenance);
  });

  test("44. summary reports product, family, geography, blueprint, state, and eligibility", () => {
    const records = [cityTarget(austin), projectGlwPreflightToTarget(cityTarget(dallas), preflight(cityTarget(dallas), "ABSENT"))];
    expect(summarizeTargetInventory(records)).toMatchObject({
      totalTargets: 2,
      byProduct: { "prod-indoor-led-video-wall": 2 },
      byFamily: { "family-standard-dvled": 2 },
      byState: { TX: 2 },
      byEligibility: { ELIGIBLE_CREATE: 1, UNKNOWN_REQUIRES_PREFLIGHT: 1 },
    });
  });
});

describe("002A persistent target inventory", () => {
  beforeEach(() => resetTargetInventoryRepositoryForTests());

  test("45. creates, gets, and lists a planned target", () => {
    const target = cityTarget();
    persistTarget(target);
    expect(getTargetInventoryRecord(target.targetId)).toEqual(target);
    expect(listTargetInventoryRecords({ productId: indoorWall.productId })).toHaveLength(1);
  });

  test("46. same exact target identity does not duplicate", () => {
    const target = cityTarget();
    persistTarget(target);
    persistTarget(target);
    expect(listTargetInventoryRecords()).toHaveLength(1);
  });

  test("47. mutable preflight metadata updates without changing identity", () => {
    const target = persistTarget(cityTarget());
    const updated = updateTargetInventoryMetadata({
      targetId: target.targetId,
      expectedTargetVersion: 1,
      patch: { targetState: "EXISTS_DRAFT", eligibility: "ELIGIBLE_UPDATE", wordpressObjectId: "3001" },
    });
    expect(updated).toMatchObject({ targetId: target.targetId, version: 2, wordpressObjectId: "3001" });
    expect(updated.identity).toEqual(target.identity);
  });

  test("48. forged identity metadata update is rejected", () => {
    const target = persistTarget(cityTarget());
    expect(() => updateTargetInventoryMetadata({
      targetId: target.targetId,
      expectedTargetVersion: 1,
      patch: { identity: { siteId: "other" } } as never,
    })).toThrow(TargetInventoryRepositoryError);
  });

  test("49. conflicting record under the same target ID fails closed", () => {
    const target = persistTarget(cityTarget());
    const conflict = { ...cityTarget(dallas), targetId: target.targetId };
    expect(() => persistTarget(conflict)).toThrow("conflicts with its immutable persisted identity");
  });

  test("50. repository revision conflict rolls back", () => {
    const target = persistTarget(cityTarget(), 0);
    const before = getTargetInventoryRecord(target.targetId);
    expect(() => updateTargetInventoryMetadata({
      targetId: target.targetId,
      expectedTargetVersion: 1,
      expectedRepositoryRevision: 0,
      patch: { targetState: "ABSENT", eligibility: "ELIGIBLE_CREATE" },
    })).toThrow("Expected repository revision 0, found 1");
    expect(getTargetInventoryRecord(target.targetId)).toEqual(before);
    expect(getTargetInventoryRepositoryRevision()).toBe(1);
  });

  test("51. stale blueprint and catalog-plan provenance are detectable", () => {
    expect(detectTargetStaleness({
      target: cityTarget(),
      currentBlueprintVersion: 2,
      currentReconciliationPlanFingerprint: "new-plan",
    })).toEqual({ stale: true, reasons: ["BLUEPRINT_VERSION_CHANGED", "RECONCILIATION_PLAN_CHANGED"] });
  });

  test("52. target inventory stores no execution status", () => {
    const target = persistTarget(cityTarget()) as unknown as Record<string, unknown>;
    expect(target.executionStatus).toBeUndefined();
    expect(target.externalExecutionId).toBeUndefined();
  });

  test("53. batch upsert validates all records and persists once", () => {
    const targets = [cityTarget(austin), cityTarget(dallas)];
    const result = upsertTargetInventoryBatch({ targets, expectedRepositoryRevision: 0 });
    expect(result).toMatchObject({ createdCount: 2, reusedCount: 0, repositoryRevision: 1 });
    expect(listTargetInventoryRecords()).toHaveLength(2);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(1);
  });
});