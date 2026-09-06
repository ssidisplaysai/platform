import { PROJECTORENCLOSURE_VINYL_WRAP_AUTHORITY } from "../projectorenclosure-customization-authority";
import { evaluateSeoRemediation } from "../seo-remediation-policy";
import { auditLegacyProductImage, AUTONOMOUS_IMAGE_REPLACEMENT_ENABLED, canEstablishProductTruth, validateGenerationReferenceManifest, type VisualAuthorityReference } from "../visual-product-authority";

const productReference: VisualAuthorityReference = {
  referenceId: "ssi-defender-front", sourceRole: "SSI_OWNED_PRODUCT_AUTHORITY", classification: "EXACT_PRODUCT_IMAGE", owner: "ssi", productId: "defender", productFamily: "projector-enclosures", view: "front", installationContext: null, establishesGeometry: true, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: null, durableSourceId: "wordpress-media:1", wordpressMediaId: 1, lineage: ["factory-upload"],
};

describe("reusable authority policies", () => {
  test("allows bounded SEO only when every invariant is satisfied and keeps autonomous mode disabled", () => {
    const base = { mode: "POLICY_BOUNDED" as const, ownershipEstablished: true, searchIntentEstablished: true, productAuthorityEstablished: true, unsupportedMetaClaimIdentified: true, replacementUsesVerifiedFactsOrPlanningLanguage: true, focusKeywordUnchanged: true, yoastTitleUnchanged: true, pageTitleUnchanged: true, slugUnchanged: true, canonicalUnchanged: true, robotsUnchanged: true, ownershipUnchanged: true, semanticAuditPassed: true, exactRollbackAvailable: true, competingOwnership: false, legalOrComplianceLanguage: false, confidence: "DETERMINISTIC" as const };
    expect(evaluateSeoRemediation(base)).toMatchObject({ eligible: true, autonomousWritesEnabled: false });
    expect(evaluateSeoRemediation({ ...base, mode: "AUTONOMOUS_VERIFIED" })).toMatchObject({ eligible: false, blockers: ["AUTONOMOUS_WRITES_DISABLED"] });
    expect(evaluateSeoRemediation({ ...base, productAuthorityEstablished: false }).blockers).toContain("PRODUCT_AUTHORITY_MISSING");
  });

  test("separates product truth from environment and competitor references", () => {
    expect(canEstablishProductTruth(productReference)).toBe(true);
    const competitor = { ...productReference, referenceId: "competitor", sourceRole: "COMPETITOR_ENVIRONMENT_RESEARCH" as const, classification: "COMPETITOR_OR_NON_SSI_PRODUCT_IMAGE" as const, productId: null, environmentOnly: true, namedProductRepresentationAllowed: false };
    expect(canEstablishProductTruth(competitor)).toBe(false);
    expect(auditLegacyProductImage({ namedProductId: "defender", reference: competitor, genericPage: false })).toBe("RESEARCH_REQUIRED");
  });

  test("requires product truth and every prohibited inference in generation manifests", () => {
    const manifest = { productId: "defender", productReferences: [productReference.referenceId], installationReferences: [], environmentReferences: [], permittedTransformations: ["CONTEXTUAL_PLACEMENT" as const], prohibitedInferences: ["new vents", "new locks", "new doors", "new dimensions", "new weather seals", "new controls", "new mounting systems", "unsupported physical features"] };
    expect(validateGenerationReferenceManifest(manifest, [productReference])).toEqual([]);
    expect(validateGenerationReferenceManifest({ ...manifest, productReferences: [] }, [productReference])).toContain("PRODUCT_VISUAL_AUTHORITY_MISSING");
    expect(AUTONOMOUS_IMAGE_REPLACEMENT_ENABLED).toBe(false);
  });

  test("bounds owner-confirmed vinyl wrap authority to aesthetics", () => {
    expect(PROJECTORENCLOSURE_VINYL_WRAP_AUTHORITY.aestheticIntents).toEqual(["BLEND_IN", "STAND_OUT", "CUSTOM_GRAPHIC"]);
    expect(PROJECTORENCLOSURE_VINYL_WRAP_AUTHORITY.requiresAuthoritativeUnderlyingGeometry).toBe(true);
    expect(PROJECTORENCLOSURE_VINYL_WRAP_AUTHORITY.prohibitedInferences).toContain("thermal performance change");
  });
});