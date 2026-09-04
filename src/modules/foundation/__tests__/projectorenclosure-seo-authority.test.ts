jest.mock("server-only", () => ({}));

import {
  loadProjectorEnclosureSeoAuthority,
  type ProjectorEnclosureKeywordOwner,
} from "../projectorenclosure-seo-authority";

const authority = loadProjectorEnclosureSeoAuthority();
const irvineUrl = "https://projectorenclosure.com/irvine-fan-cooled-projector-enclosures/";

describe("ProjectorEnclosure workbook SEO authority", () => {
  test("loads the exact-deduplicated authority and specialized subsets", () => {
    expect(authority.keywords).toHaveLength(2270);
    expect(authority.projectionMappingKeywords).toHaveLength(297);
    expect(authority.compatibilityKeywords).toHaveLength(159);
    expect(authority.electricalKeywords).toHaveLength(72);
    expect(authority.stateKeywords).toHaveLength(765);
    expect(authority.cityKeywords).toHaveLength(3000);
    expect(authority.pageMappings).toHaveLength(9);
    expect(authority.sourceCount).toBe(5);
  });

  test("preserves exact workbook and row provenance", () => {
    expect(authority.provenance).toMatchObject({
      fileName: "Projector_Enclosure_Master_Keyword_Universe.xlsx",
      sha256: "12443dc819d59d4c2aa99ab11626b86682c5299c6a4bf415821479c9585867ac",
      sourcePath: "resources/seo-authority/projectorenclosure/Projector_Enclosure_Master_Keyword_Universe.xlsx",
    });
    expect(authority.findExactKeyword("fan cooled projector enclosure")).toMatchObject({
      masterId: "125",
      sourceSheet: "Master Keywords",
      sourceRow: 129,
    });
  });

  test("supports exact and cluster lookup without fuzzy frequency scoring", () => {
    const keyword = authority.findExactKeyword("fan cooled projector enclosure");
    expect(keyword).toMatchObject({
      cluster: "Climate-Controlled Projector Enclosures",
      intent: "Commercial/product",
      buyerStage: "Consideration",
      pageTarget: "General Projector Enclosures",
    });
    expect(authority.findCluster(keyword!.cluster).some((candidate) => candidate.masterId === "125")).toBe(true);
    expect(authority.findExactKeyword("fan cooling enclosure approximation")).toBeNull();
  });

  test("resolves close variants as secondary wording rather than competing primaries", () => {
    expect(authority.findCloseVariants("projector enclosure")).toEqual(expect.arrayContaining([
      "projector enclosure",
      "projector enclosures",
    ]));
  });

  test("maps workbook roles to existing Site Studio page types", () => {
    expect(authority.pageMappings.find((mapping) => mapping.pageTarget === "General Projector Enclosures"))
      .toMatchObject({ siteStudioPageType: "general_service", keywordCount: 1192 });
    expect(authority.pageMappings.find((mapping) => mapping.pageTarget === "Compatibility / Model"))
      .toMatchObject({ siteStudioPageType: "general_service", keywordCount: 159 });
  });

  test("keeps geography ineligible until the exact location page is validated", () => {
    const blocked = authority.select({
      canonicalUrl: irvineUrl,
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      existingOwners: [],
      city: "Irvine",
      state: "California",
    });
    expect(blocked).toMatchObject({ eligible: false, geographicVariant: null });

    const selected = authority.select({
      canonicalUrl: irvineUrl,
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      city: "Irvine",
      state: "California",
      geographyValidated: true,
      existingOwners: [],
    });
    expect(selected).toMatchObject({
      eligible: true,
      primaryKeyword: { keyword: "projector enclosure Irvine California", sourceSheet: "City Expansion" },
      geographicVariant: { pageRecommendation: "Validate before city landing page" },
      intent: "Commercial/product",
      buyerStage: "Consideration",
      secondaryKeywords: [{ keyword: "fan cooled projector enclosure" }],
      recommendedRole: "Primary category and product overview",
    });
  });

  test("fails compatibility closed until technical authority verifies the exact keyword", () => {
    const keyword = authority.compatibilityKeywords[0].keyword;
    expect(authority.compatibilityEligibility(keyword, [])).toBe(false);
    expect(authority.compatibilityEligibility(keyword, [keyword])).toBe(true);

    const blocked = authority.select({
      canonicalUrl: "https://projectorenclosure.com/compatibility/",
      pageType: "general_service",
      baseKeyword: keyword,
      pageTarget: "Compatibility / Model",
      existingOwners: [],
    });
    const eligible = authority.select({
      canonicalUrl: "https://projectorenclosure.com/compatibility/",
      pageType: "general_service",
      baseKeyword: keyword,
      pageTarget: "Compatibility / Model",
      verifiedCompatibilityKeywords: [keyword],
      existingOwners: [],
    });
    expect(blocked.eligible).toBe(false);
    expect(eligible.eligible).toBe(true);
  });

  test("fails electrical targeting closed until an exact product specification supports it", () => {
    const keyword = authority.electricalKeywords[0].keyword;
    expect(authority.electricalEligibility(keyword, [])).toBe(false);
    expect(authority.electricalEligibility(keyword, [keyword])).toBe(true);

    const blocked = authority.select({
      canonicalUrl: "https://projectorenclosure.com/electrical/",
      pageType: "general_service",
      baseKeyword: keyword,
      pageTarget: "Electrical Specifications",
      existingOwners: [],
    });
    const eligible = authority.select({
      canonicalUrl: "https://projectorenclosure.com/electrical/",
      pageType: "general_service",
      baseKeyword: keyword,
      pageTarget: "Electrical Specifications",
      verifiedElectricalKeywords: [keyword],
      existingOwners: [],
    });
    expect(blocked.eligible).toBe(false);
    expect(eligible.eligible).toBe(true);
  });

  test("selects only explicitly verified same-cluster secondary keywords", () => {
    const verifiedSecondaryKeywords = authority.findCluster("Climate-Controlled Projector Enclosures")
      .filter((keyword) => keyword.pageTarget === "General Projector Enclosures" && keyword.masterId !== "125")
      .slice(0, 3)
      .map((keyword) => keyword.keyword);
    const result = authority.select({
      canonicalUrl: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
      pageType: "general_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      verifiedSecondaryKeywords,
      secondaryLimit: 3,
      existingOwners: [],
    });
    expect(result.primaryKeyword).toMatchObject({ masterId: "125", keyword: "fan cooled projector enclosure" });
    expect(result.secondaryKeywords).toHaveLength(3);
    expect(result.secondaryKeywords.every((keyword) => keyword.cluster === "Climate-Controlled Projector Enclosures")).toBe(true);
  });

  test("does not infer unsupported capabilities from cluster membership", () => {
    const result = authority.select({
      canonicalUrl: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
      pageType: "general_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      existingOwners: [],
    });
    expect(result.secondaryKeywords).toEqual([]);
  });

  test("rejects a primary already owned by another canonical page", () => {
    const owners: ProjectorEnclosureKeywordOwner[] = [{
      canonicalUrl: "https://projectorenclosure.com/competing-page/",
      primaryKeyword: "projector enclosure Irvine California",
      pageTarget: "General Projector Enclosures",
    }];
    const result = authority.select({
      canonicalUrl: irvineUrl,
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      existingOwners: [],
      city: "Irvine",
      state: "California",
      geographyValidated: true,
      existingOwners: owners,
    });
    expect(result).toMatchObject({
      eligible: false,
      cannibalization: {
        passed: false,
        conflictingCanonicalUrl: "https://projectorenclosure.com/competing-page/",
      },
    });
  });

  test("allows an existing canonical page to retain its own primary keyword", () => {
    const result = authority.select({
      canonicalUrl: irvineUrl,
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      city: "Irvine",
      state: "California",
      geographyValidated: true,
      existingOwners: [{
        canonicalUrl: irvineUrl,
        primaryKeyword: "projector enclosure Irvine California",
        pageTarget: "General Projector Enclosures",
      }],
    });
    expect(result.cannibalization).toEqual({ passed: true, conflictingCanonicalUrl: null });
    expect(result.eligible).toBe(true);
  });

  test("does not treat another location using the same base product as cannibalization", () => {
    const result = authority.select({
      canonicalUrl: irvineUrl,
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      city: "Irvine",
      state: "California",
      geographyValidated: true,
      existingOwners: [{
        canonicalUrl: "https://projectorenclosure.com/sacramento-projector-enclosures/",
        primaryKeyword: "projector enclosure Sacramento California",
        pageTarget: "General Projector Enclosures",
        closeVariantKey: "fan cooled projector enclosure",
      }],
    });
    expect(result.cannibalization.passed).toBe(true);
    expect(result.eligible).toBe(true);
  });

  test("exposes related workbook page targets for internal-link planning", () => {
    const result = authority.select({
      canonicalUrl: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
      pageType: "general_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      existingOwners: [],
    });
    expect(result.relatedPageTargets).toContain("Climate-Controlled Enclosures");
  });

  test("rejects a relative canonical target before selection", () => {
    const result = authority.select({
      canonicalUrl: "irvine-fan-cooled-projector-enclosures/",
      pageType: "city_service",
      baseKeyword: "fan cooled projector enclosure",
      pageTarget: "General Projector Enclosures",
      city: "Irvine",
      state: "California",
      geographyValidated: true,
      existingOwners: [],
    });
    expect(result.eligible).toBe(false);
    expect(result.selectionRationale).toContain("exact HTTPS canonical target");
  });
});
