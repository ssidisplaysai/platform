import { resolvePermissions } from "@/modules/foundation/permissions";
import { evaluateProductPublishingGuard } from "@/modules/foundation/product-publishing-guard";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import {
  createProduct,
  getProductById,
  listCategories,
  listManufacturers,
  listProducts,
  updateProduct,
  validateCategories,
} from "@/modules/foundation/product-repository";
import { filterProducts } from "@/modules/foundation/product-selectors";

function buildNewProductInput() {
  return {
    organizationId: "led-display-warehouse",
    productName: "Bounded Product",
    displayName: "Bounded Product",
    slug: "bounded-product",
    sku: "LEDW-BOUNDED-001",
    modelNumber: null,
    shortDescription: "Short description",
    fullDescription: "Full description",
    productType: "led_display" as const,
    productFamily: "test",
    categoryIds: ["cat-led-displays"],
    manufacturerId: "mfr-ledw-internal",
    brandReference: null,
    primarySiteId: "site-led-display-warehouse-production",
    assignedSiteIds: ["site-led-display-warehouse-production"],
    siteAssignments: [
      {
        siteId: "site-led-display-warehouse-production",
        enabledForSite: true,
        siteSpecificSlug: "bounded-product",
        siteSpecificDisplayName: "Bounded Product",
        siteSpecificShortDescription: "Short",
        visibility: "internal" as const,
        featured: false,
        sortOrder: 1,
        categoryIds: ["cat-led-displays"],
        defaultContentType: "article" as const,
        publicationStatus: "not_ready" as const,
        seoProfileReference: null,
        promptProfileReference: null,
        imageProfileReference: null,
        pricingDisplayMode: "request_quote" as const,
        lastReadinessEvaluation: null,
        lastPublicationReference: null,
      },
    ],
    media: {
      primaryImageReference: null,
      galleryImageReferences: [],
      videoReferences: [],
    },
    documents: {
      technicalDrawingReferences: [],
      specSheetReferences: [],
      brochureReferences: [],
      manualReferences: [],
      installationGuideReferences: [],
      warrantyDocumentReferences: [],
    },
    specifications: [],
    seoProfileReference: null,
    promptProfileReference: null,
    businessGenomeObjectReference: null,
    sourceEvidenceReference: null,
    notes: null,
  };
}

describe("GCP-0002D product and catalog foundation", () => {
  test("fixture-backed products exist", () => {
    const products = listProducts();
    expect(products.length).toBeGreaterThanOrEqual(6);
    expect(products.some((product) => product.productName === "Indoor LED Video Wall")).toBe(true);
  });

  test("categories and manufacturers are available", () => {
    expect(listCategories().length).toBeGreaterThan(0);
    expect(listManufacturers().length).toBeGreaterThan(0);
  });

  test("category hierarchy validation passes for baseline fixtures", () => {
    const validation = validateCategories();
    expect(validation.valid).toBe(true);
  });

  test("filterProducts supports query and category filtering", () => {
    const products = listProducts();
    const byQuery = filterProducts(products, { query: "sphere" });
    expect(byQuery.length).toBeGreaterThan(0);

    const byCategory = filterProducts(products, { categoryId: "cat-kiosks" });
    expect(byCategory.length).toBe(1);
    expect(byCategory[0]?.slug).toBe("outdoor-digital-kiosk");
  });

  test("duplicate slug is rejected", () => {
    const input = buildNewProductInput();
    input.slug = "indoor-led-video-wall";

    const result = createProduct(input);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.field === "slug")).toBe(true);
  });

  test("duplicate sku is rejected", () => {
    const input = buildNewProductInput();
    input.sku = "LEDW-INDOOR-WALL";

    const result = createProduct(input);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.field === "sku")).toBe(true);
  });

  test("missing primary site and categories are rejected", () => {
    const input = buildNewProductInput();
    input.primarySiteId = null;
    input.categoryIds = [];

    const result = createProduct(input);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.field === "primarySiteId")).toBe(true);
    expect(result.validation.issues.some((issue) => issue.field === "categoryIds")).toBe(true);
  });

  test("readiness blocks incomplete site assignment", () => {
    const product = getProductById("prod-outdoor-led-video-wall");
    expect(product).toBeDefined();

    const readiness = evaluateProductReadiness({
      product: product!,
      requiredPermission: "products:evaluate_readiness",
      permissions: resolvePermissions(["ops_manager"]),
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("missing or disabled") || reason.includes("disabled")),
    ).toBe(true);
  });

  test("publishing guard blocks non-ready product", () => {
    const product = getProductById("prod-indoor-led-video-wall");
    expect(product).toBeDefined();

    const guard = evaluateProductPublishingGuard({
      product: product!,
      permissions: resolvePermissions(["ops_manager"]),
    });

    expect(guard.allowed).toBe(false);
    expect(guard.reasons.length).toBeGreaterThan(0);
  });

  test("update rejects organization reassignment", () => {
    const result = updateProduct("prod-indoor-led-video-wall", {
      organizationId: "another-org",
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.field === "organizationId")).toBe(true);
  });
});
