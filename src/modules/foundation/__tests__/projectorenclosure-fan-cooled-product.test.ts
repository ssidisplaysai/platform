jest.mock("server-only", () => ({}));

import {
  buildFanCooledProductInput,
  buildHomelineProductInput,
  HOMELINE_PRODUCT_ID,
  PROJECTOR_ENCLOSURE_PRODUCT_ID,
  restoreMissingFanCooledProductAuthority,
} from "../projectorenclosure-site-studio-configuration";
import {
  createCategory,
  createManufacturer,
  createProduct,
  getProductById,
  listCategories,
  listManufacturers,
  listProducts,
  resetProductRepositoryForTests,
  updateProduct,
} from "../product-repository";

const normalizedAt = "2026-09-05T00:00:00.000Z";

function ensureDependencies() {
  createManufacturer({ manufacturerId: "mfr-ssi-projector-enclosures", organizationId: "ssi", name: "Screen Solutions International", displayName: "Screen Solutions International", slug: "screen-solutions-international-projector-enclosures", website: "https://projectorenclosure.com", status: "active", businessGenomeReference: null, notes: "ProjectorEnclosure manufacturer authority." });
  if (!listCategories().some((category) => category.categoryId === "cat-ssi-projector-enclosures")) {
    expect(createCategory({ organizationId: "ssi", name: "Projector Enclosures", slug: "projector-enclosures", description: "Protective projector enclosure products.", siteAssignments: ["site-ssi-projectorenclosure"] }).validation.valid).toBe(true);
  }
}

describe("ProjectorEnclosure Fan Cooled product authority", () => {
  beforeEach(() => {
    resetProductRepositoryForTests();
    ensureDependencies();
  });

  test("builds only the exact canonical identity, media, and three source-backed specs", () => {
    const input = buildFanCooledProductInput(normalizedAt);
    expect(input).toMatchObject({
      organizationId: "ssi",
      productName: "Fan Cooled Projector Enclosures",
      displayName: "Fan Cooled Projector Enclosures",
      slug: "fan-cooled-projector-enclosures",
      sku: "WP-PROJECTORENCLOSURE-10541",
      productType: "projector_enclosure",
      productFamily: "Fan Cooled Projector Enclosures",
      categoryIds: ["cat-ssi-projector-enclosures"],
      manufacturerId: "mfr-ssi-projector-enclosures",
      primarySiteId: "site-ssi-projectorenclosure",
      assignedSiteIds: ["site-ssi-projectorenclosure"],
      media: { primaryImageReference: "wordpress-media:10757" },
      sourceEvidenceReference: "wordpress-page:10541:https://projectorenclosure.com/fan-cooled-projector-enclosures/",
      authorityProvenance: { sourceType: "OWNER_APPROVED_CANONICAL_PRODUCT", authorityReference: "wordpress-page:10541", normalizationVersion: "fan-cooled-canonical-source-v1", normalizedAt },
    });
    expect(input.specifications).toEqual([
      expect.objectContaining({ key: "cooling_method", rawValue: "Built-In Fan Cooling", normalizedValue: "Fan Cooled", sourceReference: "wordpress-page:10541" }),
      expect.objectContaining({ key: "construction", rawValue: "Durable Metal Construction", normalizedValue: "Metal", sourceReference: "wordpress-page:10541" }),
      expect.objectContaining({ key: "service_access", rawValue: "Removable or hinged access panels", sourceReference: "wordpress-page:10541" }),
    ]);
  });

  test("does not promote unsupported generated-page claims", () => {
    const input = buildFanCooledProductInput(normalizedAt);
    const serialized = JSON.stringify({ shortDescription: input.shortDescription, fullDescription: input.fullDescription, specifications: input.specifications }).toLowerCase();
    expect(serialized).not.toMatch(/industrial|filter|lock|tamper|all-season|lifespan|uv resistance|airtight|variable-speed|thermal insulation|btu|mounting|ip\d|weatherproof|waterproof|universal/);
  });

  test("restores once, is idempotent, and preserves Homeline and unrelated products", () => {
    const unrelatedIds = new Set(listProducts().map((product) => product.productId));
    const homeline = createProduct(buildHomelineProductInput(normalizedAt));
    expect(homeline.validation.valid).toBe(true);
    const beforeCount = listProducts().length;

    const first = restoreMissingFanCooledProductAuthority(normalizedAt);
    const afterFirstCount = listProducts().length;
    const second = restoreMissingFanCooledProductAuthority("2026-09-05T01:00:00.000Z");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(afterFirstCount).toBe(beforeCount + 1);
    expect(listProducts()).toHaveLength(afterFirstCount);
    expect(getProductById(PROJECTOR_ENCLOSURE_PRODUCT_ID)).toMatchObject({ lifecycleState: "active", catalogStatus: "ready", enabled: true, visibility: "public_candidate" });
    expect(getProductById(HOMELINE_PRODUCT_ID)?.media.primaryImageReference).toBe("wordpress-media:11972");
    expect([...unrelatedIds].every((productId) => getProductById(productId))).toBe(true);
    expect(listCategories().filter((category) => category.categoryId === "cat-ssi-projector-enclosures")).toHaveLength(1);
    expect(listManufacturers().filter((manufacturer) => manufacturer.manufacturerId === "mfr-ssi-projector-enclosures")).toHaveLength(1);
  });

  test("fails closed when exact category or manufacturer authority is absent", () => {
    resetProductRepositoryForTests();
    expect(() => restoreMissingFanCooledProductAuthority(normalizedAt)).toThrow(/authority is required/);
    expect(getProductById(PROJECTOR_ENCLOSURE_PRODUCT_ID)).toBeNull();
  });

  test("fails closed instead of accepting an existing mismatched authority record", () => {
    const created = createProduct(buildFanCooledProductInput(normalizedAt)).product!;
    expect(updateProduct(created.productId, { lifecycleState: "active", catalogStatus: "ready", enabled: true, visibility: "public_candidate", media: { ...created.media, primaryImageReference: "wordpress-media:wrong" } }).validation.valid).toBe(true);
    expect(() => restoreMissingFanCooledProductAuthority(normalizedAt)).toThrow("Existing Fan Cooled product does not match canonical authority.");
  });
});