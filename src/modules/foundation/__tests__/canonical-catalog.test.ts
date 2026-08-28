import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import {
  createCanonicalCatalogReadModel,
  createProductVariantKey,
  projectProductConfiguration,
  projectProductSpecificationToAttributeValue,
  resolveLegacyProductFamilyId,
  type AttributeDefinition,
  type AttributeValue,
  type ProductFamily,
  type ProductVariant,
} from "@/modules/foundation/canonical-catalog";
import {
  createProduct,
  getCanonicalCatalogReadModel,
  getCanonicalProduct,
  getProductById,
  listCanonicalProducts,
  resetProductRepositoryForTests,
  updateProduct,
} from "@/modules/foundation/product-repository";
import type { NewProductInput, ProductSpecification } from "@/modules/foundation/types";

const FAMILY: ProductFamily = {
  productFamilyId: "family-led-video-wall",
  organizationId: "led-display-warehouse",
  name: "LED Video Wall",
  slug: "led-video-wall",
  status: "active",
  attributeDefinitionIds: ["attribute-pixel-pitch"],
  variantIdentityPolicy: { attributeDefinitionIds: ["attribute-pixel-pitch"] },
  version: 1,
  legacyIdentifiers: ["indoor-led"],
};

const IDENTITY_DEFINITION: AttributeDefinition = {
  attributeDefinitionId: "attribute-pixel-pitch",
  key: "pixel-pitch",
  label: "Pixel Pitch",
  dataType: "DIMENSION",
  unitDimension: "length",
  allowedUnits: ["mm"],
  cardinality: "SINGLE",
  identityBearing: true,
  requiredForVariant: true,
  visibility: "PUBLIC",
  normalizationPolicy: { trim: true, caseNormalization: "LOWERCASE", canonicalUnit: "mm" },
  version: 1,
};

const NON_IDENTITY_DEFINITION: AttributeDefinition = {
  ...IDENTITY_DEFINITION,
  attributeDefinitionId: "attribute-brightness-note",
  key: "brightness-note",
  label: "Brightness Note",
  dataType: "STRING",
  unitDimension: null,
  allowedUnits: [],
  identityBearing: false,
  requiredForVariant: false,
  normalizationPolicy: { trim: true, caseNormalization: "NONE", canonicalUnit: null },
};

function attributeValue(
  definition: AttributeDefinition,
  value: string,
): AttributeValue {
  return {
    attributeValueId: `value-${definition.key}-${value}`,
    ownerType: "VARIANT",
    ownerId: "variant-test",
    attributeDefinitionId: definition.attributeDefinitionId,
    rawValue: value,
    normalizedValue: value,
    unit: definition.normalizationPolicy.canonicalUnit,
    confidence: null,
    sourceProvenanceIds: [],
    sourceReference: null,
    evidenceReference: null,
    visibility: definition.visibility,
    sortOrder: 0,
  };
}

describe("canonical catalog compatibility", () => {
  beforeEach(() => resetProductRepositoryForTests());

  test("existing ProductConfiguration records remain readable and projectable", () => {
    const existing = getProductById("prod-indoor-led-video-wall");
    const canonical = getCanonicalProduct("prod-indoor-led-video-wall");

    expect(existing).not.toBeNull();
    expect(canonical?.productId).toBe(existing?.productId);
    expect(canonical?.configuration).toEqual(existing);
  });

  test("existing repository create and update operations remain compatible", () => {
    const source = FOUNDATION_PRODUCTS[0];
    const {
      productId: _productId,
      lifecycleState: _lifecycleState,
      catalogStatus: _catalogStatus,
      enabled: _enabled,
      visibility: _visibility,
      featured: _featured,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      publishedAt: _publishedAt,
      ...createFields
    } = source;
    const input: NewProductInput = {
      ...createFields,
      productName: "Canonical Compatibility Product",
      displayName: "Canonical Compatibility Product",
      slug: "canonical-compatibility-product",
      sku: "CANONICAL-COMPAT-001",
    };

    const created = createProduct(input);
    expect(created.validation.valid).toBe(true);
    expect(created.product).not.toBeNull();
    const updated = updateProduct(created.product!.productId, { displayName: "Updated Canonical Product" });
    expect(updated.validation.valid).toBe(true);
    expect(updated.product?.displayName).toBe("Updated Canonical Product");
  });

  test("legacy product family strings coexist with canonical family identity", () => {
    expect(resolveLegacyProductFamilyId("indoor-led", [FAMILY])).toBe(FAMILY.productFamilyId);
    expect(resolveLegacyProductFamilyId("unmapped-family", [FAMILY])).toBeNull();

    const product = { ...FOUNDATION_PRODUCTS[0], productFamily: "indoor-led" };
    const canonical = projectProductConfiguration({ product, productFamilies: [FAMILY] });
    expect(canonical.productFamilyId).toBe(FAMILY.productFamilyId);
    expect(canonical.configuration.productFamily).toBe("indoor-led");
  });

  test("variant keys are deterministic and independent of attribute ordering", () => {
    const pitch = attributeValue(IDENTITY_DEFINITION, "1.5");
    const note = attributeValue(NON_IDENTITY_DEFINITION, "High brightness");
    const first = createProductVariantKey({
      productId: "product-1",
      attributeValues: [pitch, note],
      attributeDefinitions: [IDENTITY_DEFINITION, NON_IDENTITY_DEFINITION],
    });
    const reordered = createProductVariantKey({
      productId: "product-1",
      attributeValues: [note, pitch],
      attributeDefinitions: [NON_IDENTITY_DEFINITION, IDENTITY_DEFINITION],
    });
    expect(reordered).toBe(first);
  });

  test("different identity values change the variant key", () => {
    const key = (value: string) => createProductVariantKey({
      productId: "product-1",
      attributeValues: [attributeValue(IDENTITY_DEFINITION, value)],
      attributeDefinitions: [IDENTITY_DEFINITION],
    });
    expect(key("1.5")).not.toBe(key("2.6"));
  });

  test("non-identity attribute changes do not change the variant key", () => {
    const key = (note: string) => createProductVariantKey({
      productId: "product-1",
      attributeValues: [
        attributeValue(IDENTITY_DEFINITION, "1.5"),
        attributeValue(NON_IDENTITY_DEFINITION, note),
      ],
      attributeDefinitions: [IDENTITY_DEFINITION, NON_IDENTITY_DEFINITION],
    });
    expect(key("First note")).toBe(key("Second note"));
  });

  test("ProductSpecification projection preserves supported values and references", () => {
    const specification: ProductSpecification = {
      specificationId: "spec-1",
      specificationGroup: "Display",
      key: "pixel-pitch",
      displayLabel: "Pixel Pitch",
      rawValue: "1.5 mm",
      normalizedValue: "1.5",
      unit: "mm",
      sortOrder: 4,
      sourceReference: "source-1",
      evidenceReference: "evidence-1",
      confidence: 0.95,
      visibility: "public",
    };
    const projected = projectProductSpecificationToAttributeValue({
      productId: "product-1",
      specification,
      attributeDefinitionId: IDENTITY_DEFINITION.attributeDefinitionId,
    });
    expect(projected).toMatchObject({
      rawValue: "1.5 mm",
      normalizedValue: "1.5",
      unit: "mm",
      confidence: 0.95,
      sourceReference: "source-1",
      evidenceReference: "evidence-1",
      sortOrder: 4,
      visibility: "PUBLIC",
    });
    expect(projected.sourceProvenanceIds).toEqual([]);
  });

  test("products without variants or provenance remain valid compatibility projections", () => {
    const canonical = projectProductConfiguration({ product: FOUNDATION_PRODUCTS[0] });
    expect(canonical.variants).toEqual([]);
    expect(canonical.productFamilyId).toBeNull();
    expect(canonical.version).toBe(1);
  });

  test("existing media and document references project without mutation", () => {
    const product = {
      ...FOUNDATION_PRODUCTS[0],
      media: {
        primaryImageReference: "media://primary",
        galleryImageReferences: ["media://gallery"],
        videoReferences: ["media://video"],
      },
      documents: {
        ...FOUNDATION_PRODUCTS[0].documents,
        specSheetReferences: ["document://spec-sheet"],
      },
    };
    const canonical = projectProductConfiguration({ product });
    expect(canonical.mediaAssets.map((asset) => asset.uri)).toEqual([
      "media://primary",
      "media://gallery",
      "media://video",
    ]);
    expect(canonical.documentAssets.map((asset) => asset.uri)).toContain("document://spec-sheet");
    expect(canonical.mediaAssets.every((asset) => asset.status === "REFERENCE_ONLY")).toBe(true);
  });

  test("canonical catalog read model represents every existing fixture product", () => {
    const model = createCanonicalCatalogReadModel({ products: FOUNDATION_PRODUCTS });
    expect(model.products).toHaveLength(FOUNDATION_PRODUCTS.length);
    expect(model.products.map((product) => product.productId)).toEqual(
      FOUNDATION_PRODUCTS.map((product) => product.productId),
    );
    expect(model.productVariants).toEqual([]);
  });

  test("existing repository exposes canonical reads over the same product store", () => {
    expect(listCanonicalProducts()).toHaveLength(FOUNDATION_PRODUCTS.length);
    expect(getCanonicalCatalogReadModel().products).toHaveLength(FOUNDATION_PRODUCTS.length);
  });

  test("canonical projection preserves site, readiness, taxonomy, and profile relationships", () => {
    const source = FOUNDATION_PRODUCTS[0];
    const canonical = projectProductConfiguration({ product: source });
    expect(canonical.primarySiteId).toBe(source.primarySiteId);
    expect(canonical.siteAssignments).toEqual(source.siteAssignments);
    expect(canonical.catalogStatus).toBe(source.catalogStatus);
    expect(canonical.lifecycleState).toBe(source.lifecycleState);
    expect(canonical.categoryIds).toEqual(source.categoryIds);
    expect(canonical.manufacturerId).toBe(source.manufacturerId);
    expect(canonical.seoProfileReference).toBe(source.seoProfileReference);
    expect(canonical.promptProfileReference).toBe(source.promptProfileReference);
  });

  test("unresolved legacy family data remains intact without destructive reconciliation", () => {
    const source = { ...FOUNDATION_PRODUCTS[0], productFamily: "legacy-unresolved" };
    const canonical = projectProductConfiguration({ product: source, productFamilies: [FAMILY] });
    expect(canonical.productFamilyId).toBeNull();
    expect(canonical.productFamily).toBe("legacy-unresolved");
  });

  test("equivalent normalized identity values produce the same variant key", () => {
    const key = (rawValue: string, normalizedValue: string) => {
      const value = { ...attributeValue(IDENTITY_DEFINITION, rawValue), normalizedValue };
      return createProductVariantKey({
        productId: "product-1",
        attributeValues: [value],
        attributeDefinitions: [IDENTITY_DEFINITION],
      });
    };
    expect(key("1.5 MM", "1.5")).toBe(key("1.5 mm", " 1.5 "));

    const millimeters = attributeValue(IDENTITY_DEFINITION, "1.5");
    const inches = { ...millimeters, unit: "in" };
    expect(createProductVariantKey({
      productId: "product-1",
      attributeValues: [millimeters],
      attributeDefinitions: [IDENTITY_DEFINITION],
    })).not.toBe(createProductVariantKey({
      productId: "product-1",
      attributeValues: [inches],
      attributeDefinitions: [IDENTITY_DEFINITION],
    }));
  });

  test("read model associates first-class variants with their existing product", () => {
    const attributeValues = [attributeValue(IDENTITY_DEFINITION, "1.5")];
    const variant: ProductVariant = {
      variantId: "variant-product-1-p15",
      productId: FOUNDATION_PRODUCTS[0].productId,
      variantKey: createProductVariantKey({
        productId: FOUNDATION_PRODUCTS[0].productId,
        attributeValues,
        attributeDefinitions: [IDENTITY_DEFINITION],
      }),
      sku: "VARIANT-P15",
      modelNumber: null,
      attributeValues,
      status: "active",
      pageEligibility: "UNASSESSED",
      version: 1,
    };
    const model = createCanonicalCatalogReadModel({
      products: FOUNDATION_PRODUCTS,
      productVariants: [variant],
      attributeDefinitions: [IDENTITY_DEFINITION],
    });
    expect(model.productVariants).toEqual([variant]);
    expect(model.products[0].variants).toEqual([variant]);
  });
});