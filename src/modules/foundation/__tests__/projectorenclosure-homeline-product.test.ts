jest.mock("server-only", () => ({}));

import {
  buildHomelineProductInput,
  buildHomelineProductUpdate,
  homelineProductRequiresUpdate,
  HOMELINE_PRODUCT_ID,
} from "../projectorenclosure-site-studio-configuration";
import {
  createCategory,
  createManufacturer,
  createProduct,
  getCanonicalProduct,
  getProductById,
  listCategories,
  resetProductRepositoryForTests,
  updateProduct,
} from "../product-repository";

const normalizedAt = "2026-09-03T23:59:00.000Z";

function ensureDependencies() {
  createManufacturer({
    manufacturerId: "mfr-ssi-projector-enclosures",
    organizationId: "ssi",
    name: "Screen Solutions International",
    displayName: "Screen Solutions International",
    slug: "screen-solutions-international-projector-enclosures",
    website: "https://projectorenclosure.com",
    status: "active",
    businessGenomeReference: null,
    notes: "ProjectorEnclosure manufacturer authority.",
  });
  if (!listCategories().some((category) => category.categoryId === "cat-ssi-projector-enclosures")) {
    const category = createCategory({
      organizationId: "ssi",
      name: "Projector Enclosures",
      slug: "projector-enclosures",
      description: "Protective projector enclosure products.",
      siteAssignments: ["site-ssi-projectorenclosure"],
    });
    expect(category.validation.valid).toBe(true);
  }
}

describe("ProjectorEnclosure Homeline normalized product authority", () => {
  beforeEach(() => {
    resetProductRepositoryForTests();
    ensureDependencies();
  });

  test("creates exactly the approved owner-authorized identity", () => {
    const result = createProduct(buildHomelineProductInput(normalizedAt));

    expect(result.validation.valid).toBe(true);
    expect(result.product).toMatchObject({
      productId: HOMELINE_PRODUCT_ID,
      productName: "Homeline Projector Enclosure",
      slug: "homeline-projector-enclosure",
      sku: "SSI-HOMELINE-PE",
      productFamily: "Consumer Fan-Cooled Projector Enclosure",
      categoryIds: ["cat-ssi-projector-enclosures"],
      manufacturerId: "mfr-ssi-projector-enclosures",
      sourceEvidenceReference: "wordpress-page:11852:https://projectorenclosure.com/homeline-projector-enclosure/",
      media: { primaryImageReference: "wordpress-media:11972" },
      authorityProvenance: {
        sourceType: "OWNER_APPROVED_CANONICAL_PRODUCT",
        authorityReference: "owner-approved-sku:SSI-HOMELINE-PE",
        normalizationVersion: "homeline-owner-approved-v1",
        normalizedAt,
      },
    });
    expect(getProductById(HOMELINE_PRODUCT_ID)?.specifications).toHaveLength(14);
  });

  test("rejects a second Homeline identity by approved SKU and slug", () => {
    expect(createProduct(buildHomelineProductInput(normalizedAt)).validation.valid).toBe(true);
    const duplicate = createProduct(buildHomelineProductInput(normalizedAt));

    expect(duplicate.product).toBeNull();
    expect(duplicate.validation.issues.some((issue) => issue.field === "slug" || issue.field === "sku")).toBe(true);
  });

  test("projects verified dimensions, fit, cooling, power components, uses, warranty, and compatibility policy", () => {
    createProduct(buildHomelineProductInput(normalizedAt));
    const canonical = getCanonicalProduct(HOMELINE_PRODUCT_ID);
    const values = new Map(canonical?.configuration.specifications.map((specification) => [specification.key, specification.rawValue]));

    expect(Object.fromEntries(values)).toEqual(expect.objectContaining({
      construction: "Steel enclosure body",
      weight: "49 lb",
      exterior_dimensions: "23.66 x 22.60 x 10.83 in",
      maximum_projector_height: "Under 7.5 in",
      maximum_projector_depth: "Under 16 in",
      maximum_projector_width: "20 in or less",
      cooling_method: "Temperature-controlled fan cooling",
      wired_power_cord: "Included",
      internal_outlet: "Included",
      internal_breaker: "Included",
      manufacturer_warranty: "One year",
    }));
    expect(values.get("projection_mapping_uses")).toContain("house projection mapping");
    expect(values.get("compatibility_policy")).toContain("lens position");
  });

  test("does not promote excluded weather, voltage, compatibility, security, service-panel, or mounting claims", () => {
    const input = buildHomelineProductInput(normalizedAt);
    const serialized = JSON.stringify({
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      specifications: input.specifications,
    }).toLowerCase();

    expect(serialized).not.toMatch(/ip\s?rating|ip55|ip65|direct rain|direct snow|unattended outdoor|operating temperature|110v|120v|220v|universal projector|locking|security system|service panel|unistrut|mounting hardware|harsh weather/);
  });

  test("rejects malformed authority provenance", () => {
    const input = buildHomelineProductInput(normalizedAt);
    input.authorityProvenance = {
      ...input.authorityProvenance!,
      normalizedAt: "not-a-date",
    };

    const result = createProduct(input);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues).toContainEqual(expect.objectContaining({ field: "authorityProvenance.normalizedAt" }));
  });

  test("requires exact WordPress evidence for owner-approved canonical products", () => {
    const input = buildHomelineProductInput(normalizedAt);
    input.sourceEvidenceReference = "workbook-import:unsupported";

    const result = createProduct(input);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues).toContainEqual(expect.objectContaining({ field: "sourceEvidenceReference" }));
  });

  test("repeated normalization is a strict no-op when the product already matches", () => {
    const created = createProduct(buildHomelineProductInput(normalizedAt)).product!;
    const patch = buildHomelineProductUpdate(buildHomelineProductInput(normalizedAt));
    expect(homelineProductRequiresUpdate(created, patch)).toBe(true);

    const activated = updateProduct(HOMELINE_PRODUCT_ID, patch).product!;
    expect(homelineProductRequiresUpdate(activated, patch)).toBe(false);
    expect(activated.authorityProvenance?.normalizedAt).toBe(normalizedAt);
  });
});
