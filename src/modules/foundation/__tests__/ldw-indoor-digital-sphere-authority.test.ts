import {
  buildLdwIndoorDigitalSphereSpecifications,
  LDW_INDOOR_DIGITAL_SPHERE_MODELS,
  LDW_INDOOR_DIGITAL_SPHERE_PRODUCT_BROWSER_AUTHORITY,
} from "../ldw-indoor-digital-sphere-authority";
import { validateUpdateProductInput } from "../catalog-validation";
import { FOUNDATION_PRODUCTS } from "../catalog-fixtures";
import { evaluateProductReadiness } from "../product-readiness";

describe("LDW Indoor Digital Sphere Product Browser authority", () => {
  test("preserves all first-party model rows without collapsing model scope", () => {
    expect(LDW_INDOOR_DIGITAL_SPHERE_PRODUCT_BROWSER_AUTHORITY).toMatchObject({
      sourceClass: "VERIFIED_FIRST_PARTY_PRODUCT_AUTHORITY",
      categoryId: 8,
      recordCount: 38,
    });
    expect(LDW_INDOOR_DIGITAL_SPHERE_MODELS).toHaveLength(38);

    const specifications = buildLdwIndoorDigitalSphereSpecifications();
    expect(specifications).toHaveLength(114);
    expect(new Set(specifications.map((item) => item.specificationId)).size).toBe(114);
    expect(specifications.every((item) => item.confidence === 1 && item.sourceReference?.startsWith("ssi-product-browser:category:8:record:"))).toBe(true);
  });

  test("keeps pitch and resolution tied to exact browser records", () => {
    const specifications = buildLdwIndoorDigitalSphereSpecifications();
    expect(specifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ specificationGroup: "Product Browser model 163", key: "model_163_pixel_pitch", rawValue: "P2" }),
      expect.objectContaining({ specificationGroup: "Product Browser model 163", key: "model_163_resolution", rawValue: "9425 × 4712" }),
      expect.objectContaining({ specificationGroup: "Product Browser model 171", key: "model_171_pixel_pitch", rawValue: "P2.5" }),
      expect.objectContaining({ specificationGroup: "Product Browser model 171", key: "model_171_resolution", rawValue: "7540 × 3770" }),
    ]));
  });

  test("requires an exact matching first-party Product Browser category reference", () => {
    const product = FOUNDATION_PRODUCTS.find((item) => item.productId === "prod-indoor-digital-sphere")!;
    expect(validateUpdateProductInput(product, {
      sourceEvidenceReference: "ssi-product-browser:category:8:https://ssidisplays.com/product-browser/",
      authorityProvenance: {
        sourceType: "VERIFIED_FIRST_PARTY_PRODUCT_AUTHORITY",
        authorityReference: "ssi-product-browser:category:8",
        normalizationVersion: "ssi-product-browser-indoor-digital-spheres-v1",
        normalizedAt: "2026-09-07T23:29:26.779Z",
      },
    }).valid).toBe(true);
    expect(validateUpdateProductInput(product, {
      sourceEvidenceReference: "ssi-product-browser:category:9:https://ssidisplays.com/product-browser/",
      authorityProvenance: {
        sourceType: "VERIFIED_FIRST_PARTY_PRODUCT_AUTHORITY",
        authorityReference: "ssi-product-browser:category:8",
        normalizationVersion: "ssi-product-browser-indoor-digital-spheres-v1",
        normalizedAt: "2026-09-07T23:29:26.779Z",
      },
    }).valid).toBe(false);
  });

  test("binds the exact owner-approved WordPress image and launch profiles", () => {
    const product = FOUNDATION_PRODUCTS.find((item) => item.productId === "prod-indoor-digital-sphere")!;
    expect(product).toMatchObject({
      enabled: true,
      lifecycleState: "active",
      catalogStatus: "ready",
      media: { primaryImageReference: "wordpress-media:20076" },
      seoProfileReference: "profile-seo-ledw-default",
      promptProfileReference: "profile-prompt-commercial-product",
    });
    expect(product.siteAssignments).toEqual([
      expect.objectContaining({
        siteId: "site-led-display-warehouse-production",
        enabledForSite: true,
        publicationStatus: "ready",
        imageProfileReference: "profile-image-apple-product",
      }),
    ]);
    expect(evaluateProductReadiness({
      product,
      requiredPermission: "products:evaluate_readiness",
      permissions: new Set(["products:evaluate_readiness"]),
    })).toMatchObject({ ready: true, status: "ready", blockingReasons: [] });
  });
});