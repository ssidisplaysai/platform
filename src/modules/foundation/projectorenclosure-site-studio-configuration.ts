import "server-only";

import {
  createIntegrationProfile,
  evaluateProfileReadiness,
  getIntegrationProfileById,
  updateIntegrationProfile,
  upsertProfileAssignment,
} from "./integration-profile-repository";
import {
  createCategory,
  createManufacturer,
  createProduct,
  getProductById,
  listCategories,
  updateProduct,
} from "./product-repository";
import { evaluateProductReadiness } from "./product-readiness";
import { getSiteById, updateSite } from "./site-repository";
import { evaluateSiteReadiness } from "./site-readiness";
import type {
  IntegrationProfileReferenceSet,
  IntegrationProfileType,
  NewIntegrationProfileInput,
  PermissionAction,
} from "./types";

export const PROJECTOR_ENCLOSURE_SITE_ID = "site-ssi-projectorenclosure";
export const PROJECTOR_ENCLOSURE_PRODUCT_ID = "prod-ssi-fan-cooled-projector-enclosures";

export const PROJECTOR_ENCLOSURE_PROFILE_IDS = {
  brand: "profile-brand-projectorenclosure-default",
  wordpress: "profile-wordpress-projectorenclosure-default",
  publishing: "profile-publishing-projectorenclosure-default",
  seo: "profile-seo-projectorenclosure-default",
  prompt: "profile-prompt-projectorenclosure-product",
  image: "profile-image-projectorenclosure-product",
  workflow: "profile-workflow-projectorenclosure-site-studio",
} as const;

function references(values: Partial<IntegrationProfileReferenceSet>): IntegrationProfileReferenceSet {
  return {
    credentialReference: null, workflowReference: null, promptReference: null, providerReference: null, brandReference: null,
    workflowProfileReference: null, wordpressProfileReference: null, promptProfileReference: null, imageProfileReference: null,
    seoProfileReference: null, analyticsProfileReference: null, titleStrategyReference: null, metaStrategyReference: null,
    schemaReference: null, openGraphReference: null, slugStrategyReference: null, canonicalPolicyReference: null,
    logoReference: null, colorPaletteReference: null, typographyReference: null, voiceReference: null, defaultCtaReference: null,
    assetReference: null, baseUrlReference: null, authorReference: null, categoryReference: null, postStatusReference: null,
    featuredImagePolicyReference: null, imageInsertionPolicyReference: null, yoastPolicyReference: null,
    inputContractReference: null, outputContractReference: null, retryPolicyReference: null,
    executionTimeoutReference: null, environmentReference: null, ...values,
  };
}

function profile(type: IntegrationProfileType, id: string, name: string, values: Partial<IntegrationProfileReferenceSet>): NewIntegrationProfileInput {
  return {
    profileId: id, profileType: type, organizationId: "ssi", profileName: name,
    description: `ProjectorEnclosure-owned ${type} authority for Genesis Site Studio.`, status: "active", enabled: true,
    version: "1.0.0", assignedSiteIds: [PROJECTOR_ENCLOSURE_SITE_ID], defaultForOrganization: false,
    references: references(values), notes: "Site-owned references only; no SSI Displays or LEDW profile substitution.",
  };
}

const PROFILES: readonly NewIntegrationProfileInput[] = [
  profile("brand", PROJECTOR_ENCLOSURE_PROFILE_IDS.brand, "ProjectorEnclosure Brand", {
    logoReference: "projectorenclosure-current-site-logo", colorPaletteReference: "projectorenclosure-current-site-palette",
    typographyReference: "projectorenclosure-current-site-typography", voiceReference: "projectorenclosure-existing-content-voice",
    defaultCtaReference: "projectorenclosure-contact-action",
  }),
  profile("wordpress", PROJECTOR_ENCLOSURE_PROFILE_IDS.wordpress, "ProjectorEnclosure WordPress", {
    credentialReference: "projectorenclosure-site-wordpress-authority", providerReference: "provider-wordpress",
    baseUrlReference: "https://projectorenclosure.com/wp-json/wp/v2", postStatusReference: "poststatus-draft",
    featuredImagePolicyReference: "feature-image-required", environmentReference: "environment-production",
  }),
  profile("workflow", PROJECTOR_ENCLOSURE_PROFILE_IDS.workflow, "ProjectorEnclosure Site Studio Workflow", {
    workflowReference: "workflowref-site-studio-exact-job-publication-v1", providerReference: "provider-genesis-site-studio",
    retryPolicyReference: "retrypolicy-fail-closed-manual-review", executionTimeoutReference: "timeout-policy-30s",
    inputContractReference: "contractref-site-studio-job-input-v1", outputContractReference: "contractref-site-studio-job-output-v1",
  }),
  profile("prompt", PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt, "ProjectorEnclosure Product Prompt", {
    promptReference: "promptref-projectorenclosure-authoritative-product-v1", providerReference: "provider-openai-text",
    brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand,
  }),
  profile("image", PROJECTOR_ENCLOSURE_PROFILE_IDS.image, "ProjectorEnclosure Product Media", {
    promptReference: "imgpromptref-projectorenclosure-product-context-v1", providerReference: "provider-openai-image",
    brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand, featuredImagePolicyReference: "feature-image-required",
  }),
  profile("seo", PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, "ProjectorEnclosure SEO", {
    brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand, titleStrategyReference: "titlestrategy-projectorenclosure-product-market-v1",
    metaStrategyReference: "metastrategy-projectorenclosure-product-market-v1", schemaReference: "schemaref-projectorenclosure-service-page-v1",
    openGraphReference: "ogref-projectorenclosure-default-v1", slugStrategyReference: "slugstrategy-projectorenclosure-flat-market-v1",
    canonicalPolicyReference: "canonical-policy-site-primary", yoastPolicyReference: "wordpress-rest:/ssi/v1/yoast-update",
  }),
  profile("publishing", PROJECTOR_ENCLOSURE_PROFILE_IDS.publishing, "ProjectorEnclosure Publishing", {
    wordpressProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.wordpress,
    workflowProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.workflow,
    promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
    imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image,
    seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo,
  }),
];

const permissions = new Set<PermissionAction>(["sites:manage_integrations", "products:evaluate_readiness"]);
const sourceUrl = "https://projectorenclosure.com/fan-cooled-projector-enclosures/";

export function configureProjectorEnclosureSiteStudio() {
  const site = getSiteById(PROJECTOR_ENCLOSURE_SITE_ID);
  if (!site?.integrations.wordpressCredentialReference) throw new Error("ProjectorEnclosure site-owned credential is required.");

  for (const input of PROFILES) {
    const existing = getIntegrationProfileById(input.profileId);
    const result = existing
      ? updateIntegrationProfile(input.profileId, { assignedSiteIds: input.assignedSiteIds, references: input.references, status: "active", enabled: true })
      : createIntegrationProfile(input);
    if (!result.validation.valid || !result.profile) throw new Error(`ProjectorEnclosure ${input.profileType} profile validation failed.`);
    const assignment = upsertProfileAssignment({ organizationId: "ssi", targetType: "site", targetId: PROJECTOR_ENCLOSURE_SITE_ID,
      siteId: PROJECTOR_ENCLOSURE_SITE_ID, profileType: input.profileType, profileId: input.profileId, notes: "Direct ProjectorEnclosure site assignment." });
    if (!assignment.validation.valid) throw new Error(`ProjectorEnclosure ${input.profileType} assignment failed.`);
  }
  const profileReadiness = PROFILES.map((input) => evaluateProfileReadiness(input.profileId));
  if (profileReadiness.some((result) => !result?.ready)) throw new Error("ProjectorEnclosure profiles are not ready.");

  createManufacturer({ manufacturerId: "mfr-ssi-projector-enclosures", organizationId: "ssi", name: "Screen Solutions International",
    displayName: "Screen Solutions International", slug: "screen-solutions-international-projector-enclosures",
    website: "https://projectorenclosure.com", status: "active", businessGenomeReference: null,
    notes: "Authority: Fan Cooled page 10541 states Screen Solutions International designs projector enclosures." });
  if (!listCategories().some((category) => category.categoryId === "cat-ssi-projector-enclosures")) {
    const category = createCategory({ organizationId: "ssi", name: "Projector Enclosures", slug: "projector-enclosures",
      description: "Protective projector enclosure products.", siteAssignments: [PROJECTOR_ENCLOSURE_SITE_ID] });
    if (!category.validation.valid) throw new Error("ProjectorEnclosure category validation failed.");
  }

  let product = getProductById(PROJECTOR_ENCLOSURE_PRODUCT_ID);
  if (!product) {
    const created = createProduct({ organizationId: "ssi", productName: "Fan Cooled Projector Enclosures", displayName: "Fan Cooled Projector Enclosures",
      slug: "fan-cooled-projector-enclosures", sku: "WP-PROJECTORENCLOSURE-10541", modelNumber: null,
      shortDescription: "Fan-cooled projector protection for indoor, covered outdoor, and mild-environment commercial AV installations.",
      fullDescription: "Projector enclosures with integrated fan cooling, durable metal construction, and service-friendly access for controlled or semi-protected installations.",
      productType: "projector_enclosure", productFamily: "Fan Cooled Projector Enclosures", categoryIds: ["cat-ssi-projector-enclosures"],
      manufacturerId: "mfr-ssi-projector-enclosures", brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand,
      primarySiteId: PROJECTOR_ENCLOSURE_SITE_ID, assignedSiteIds: [PROJECTOR_ENCLOSURE_SITE_ID],
      siteAssignments: [{ siteId: PROJECTOR_ENCLOSURE_SITE_ID, enabledForSite: true, siteSpecificSlug: "fan-cooled-projector-enclosures",
        siteSpecificDisplayName: "Fan Cooled Projector Enclosures", siteSpecificShortDescription: null, visibility: "public_candidate", featured: false,
        sortOrder: 0, categoryIds: ["cat-ssi-projector-enclosures"], defaultContentType: "product", publicationStatus: "ready",
        seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
        imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image, pricingDisplayMode: "hidden", lastReadinessEvaluation: new Date().toISOString(), lastPublicationReference: null }],
      media: { primaryImageReference: "wordpress-media:10757", galleryImageReferences: [], videoReferences: [] },
      documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
      specifications: [
        { specificationId: "spec-projectorenclosure-cooling", specificationGroup: "Protection", key: "cooling_method", displayLabel: "Cooling Method", rawValue: "Built-In Fan Cooling", normalizedValue: "Fan Cooled", unit: null, sortOrder: 1, sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl, confidence: 1, visibility: "public" },
        { specificationId: "spec-projectorenclosure-construction", specificationGroup: "Construction", key: "construction", displayLabel: "Construction", rawValue: "Durable Metal Construction", normalizedValue: "Metal", unit: null, sortOrder: 2, sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl, confidence: 1, visibility: "public" },
        { specificationId: "spec-projectorenclosure-access", specificationGroup: "Service", key: "service_access", displayLabel: "Service Access", rawValue: "Removable or hinged access panels", normalizedValue: null, unit: null, sortOrder: 3, sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl, confidence: 1, visibility: "public" },
      ], seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
      businessGenomeObjectReference: null, sourceEvidenceReference: `wordpress-page:10541:${sourceUrl}`, notes: "Authenticated ProjectorEnclosure WordPress authority." });
    if (!created.validation.valid || !created.product) throw new Error("ProjectorEnclosure product creation failed.");
    product = created.product;
  }

  const siteResult = updateSite(PROJECTOR_ENCLOSURE_SITE_ID, { enabled: true, lifecycleState: "active", healthStatus: "healthy", publishingStatus: "ready",
    integrations: { ...site.integrations, workflowReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.workflow },
    profiles: { promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt, imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image,
      seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, brandProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand, analyticsProfileReference: null } });
  if (!siteResult.validation.valid || !siteResult.site) throw new Error("ProjectorEnclosure site activation failed.");
  const productResult = updateProduct(PROJECTOR_ENCLOSURE_PRODUCT_ID, { lifecycleState: "active", catalogStatus: "ready", enabled: true,
    visibility: "public_candidate", seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt });
  if (!productResult.validation.valid || !productResult.product) throw new Error("ProjectorEnclosure product activation failed.");

  return {
    site: siteResult.site, product: productResult.product, profileReadiness,
    siteReadiness: evaluateSiteReadiness({ site: siteResult.site, organizationActive: true, requiredPermission: "sites:manage_integrations", permissions, intent: "publish", requireWorkflowReference: true }),
    productReadiness: evaluateProductReadiness({ product: productResult.product, requiredPermission: "products:evaluate_readiness", permissions }),
  };
}