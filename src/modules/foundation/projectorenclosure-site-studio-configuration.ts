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
  listManufacturers,
  reloadProductRepositoryFromPersistence,
  updateProduct,
} from "./product-repository";
import { evaluateProductReadiness } from "./product-readiness";
import { getSiteById, updateSite } from "./site-repository";
import { evaluateSiteReadiness } from "./site-readiness";
import type {
  IntegrationProfileReferenceSet,
  IntegrationProfileType,
  NewIntegrationProfileInput,
  NewProductInput,
  PermissionAction,
  ProductConfiguration,
  UpdateProductInput,
} from "./types";

export const PROJECTOR_ENCLOSURE_SITE_ID = "site-ssi-projectorenclosure";
export const PROJECTOR_ENCLOSURE_PRODUCT_ID = "prod-ssi-fan-cooled-projector-enclosures";
export const HOMELINE_PRODUCT_ID = "prod-ssi-homeline-projector-enclosure";

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
    assetReference: "resources/seo-authority/projectorenclosure/Projector_Enclosure_Master_Keyword_Universe.xlsx",
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
const homelineSourceUrl = "https://projectorenclosure.com/homeline-projector-enclosure/";

function homelineSpecifications() {
  const sourceReference = "wordpress-page:11852";
  const common = { sourceReference, evidenceReference: homelineSourceUrl, confidence: 1, visibility: "public" as const };
  return [
    { specificationId: "spec-homeline-construction", specificationGroup: "Construction", key: "construction", displayLabel: "Construction", rawValue: "Steel enclosure body", normalizedValue: "Steel", unit: null, sortOrder: 1, ...common },
    { specificationId: "spec-homeline-weight", specificationGroup: "Physical", key: "weight", displayLabel: "Weight", rawValue: "49 lb", normalizedValue: "49", unit: "lb", sortOrder: 2, ...common },
    { specificationId: "spec-homeline-exterior-dimensions", specificationGroup: "Physical", key: "exterior_dimensions", displayLabel: "Exterior Dimensions", rawValue: "23.66 x 22.60 x 10.83 in", normalizedValue: null, unit: "in", sortOrder: 3, ...common },
    { specificationId: "spec-homeline-projector-height", specificationGroup: "Projector Fit", key: "maximum_projector_height", displayLabel: "Maximum Projector Height", rawValue: "Under 7.5 in", normalizedValue: "7.5", unit: "in", sortOrder: 4, ...common },
    { specificationId: "spec-homeline-projector-depth", specificationGroup: "Projector Fit", key: "maximum_projector_depth", displayLabel: "Maximum Projector Depth", rawValue: "Under 16 in", normalizedValue: "16", unit: "in", sortOrder: 5, ...common },
    { specificationId: "spec-homeline-projector-width", specificationGroup: "Projector Fit", key: "maximum_projector_width", displayLabel: "Maximum Projector Width", rawValue: "20 in or less", normalizedValue: "20", unit: "in", sortOrder: 6, ...common },
    { specificationId: "spec-homeline-cooling", specificationGroup: "Protection", key: "cooling_method", displayLabel: "Cooling", rawValue: "Temperature-controlled fan cooling", normalizedValue: "Temperature-Controlled Fan Cooling", unit: null, sortOrder: 7, ...common },
    { specificationId: "spec-homeline-wired-cord", specificationGroup: "Power", key: "wired_power_cord", displayLabel: "Wired Cord", rawValue: "Included", normalizedValue: "Included", unit: null, sortOrder: 8, ...common },
    { specificationId: "spec-homeline-internal-outlet", specificationGroup: "Power", key: "internal_outlet", displayLabel: "Internal Outlet", rawValue: "Included", normalizedValue: "Included", unit: null, sortOrder: 9, ...common },
    { specificationId: "spec-homeline-internal-breaker", specificationGroup: "Power", key: "internal_breaker", displayLabel: "Internal Breaker", rawValue: "Included", normalizedValue: "Included", unit: null, sortOrder: 10, ...common },
    { specificationId: "spec-homeline-environments", specificationGroup: "Application", key: "intended_environments", displayLabel: "Intended Environments", rawValue: "Home theater; covered patio; garage; backyard; mild environments", normalizedValue: null, unit: null, sortOrder: 11, ...common },
    { specificationId: "spec-homeline-mapping-uses", specificationGroup: "Application", key: "projection_mapping_uses", displayLabel: "Projection Mapping Uses", rawValue: "DIY; house projection mapping; Halloween; Christmas; seasonal projection mapping", normalizedValue: null, unit: null, sortOrder: 12, ...common },
    { specificationId: "spec-homeline-warranty", specificationGroup: "Warranty", key: "manufacturer_warranty", displayLabel: "Manufacturer Warranty", rawValue: "One year", normalizedValue: "1", unit: "year", sortOrder: 13, ...common },
    { specificationId: "spec-homeline-compatibility-policy", specificationGroup: "Projector Fit", key: "compatibility_policy", displayLabel: "Compatibility Policy", rawValue: "Verify projector dimensions, lens position, intake and exhaust locations, cable routing, and required clearance before purchase.", normalizedValue: null, unit: null, sortOrder: 14, ...common },
  ];
}

export function buildHomelineProductInput(normalizedAt: string): NewProductInput {
  return {
    organizationId: "ssi", productName: "Homeline Projector Enclosure", displayName: "Homeline Projector Enclosure",
    slug: "homeline-projector-enclosure", sku: "SSI-HOMELINE-PE", modelNumber: null,
    shortDescription: "Consumer fan-cooled steel projector enclosure for home theater, covered patio, garage, backyard, and mild-environment projection mapping setups.",
    fullDescription: "Owner-approved Homeline projector protection with a documented consumer-projector fit envelope, temperature-controlled fan cooling, integrated power components, and residential projection-mapping uses.",
    productType: "projector_enclosure", productFamily: "Consumer Fan-Cooled Projector Enclosure", categoryIds: ["cat-ssi-projector-enclosures"],
    manufacturerId: "mfr-ssi-projector-enclosures", brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand,
    primarySiteId: PROJECTOR_ENCLOSURE_SITE_ID, assignedSiteIds: [PROJECTOR_ENCLOSURE_SITE_ID],
    siteAssignments: [{ siteId: PROJECTOR_ENCLOSURE_SITE_ID, enabledForSite: true, siteSpecificSlug: "homeline-projector-enclosure",
      siteSpecificDisplayName: "Homeline Projector Enclosure", siteSpecificShortDescription: null, visibility: "public_candidate", featured: false,
      sortOrder: 1, categoryIds: ["cat-ssi-projector-enclosures"], defaultContentType: "product_update", publicationStatus: "ready",
      seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
      imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image, pricingDisplayMode: "hidden", lastReadinessEvaluation: normalizedAt, lastPublicationReference: null }],
    media: { primaryImageReference: "wordpress-media:11972", galleryImageReferences: [], videoReferences: [] },
    documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
    specifications: homelineSpecifications(), seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo,
    promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt, businessGenomeObjectReference: null,
    sourceEvidenceReference: `wordpress-page:11852:${homelineSourceUrl}`,
    authorityProvenance: { sourceType: "OWNER_APPROVED_CANONICAL_PRODUCT", authorityReference: "owner-approved-sku:SSI-HOMELINE-PE", normalizationVersion: "homeline-owner-approved-v1", normalizedAt },
    notes: "Owner-approved canonical product authority. Do not infer IP rating, direct-weather exposure, voltage, universal compatibility, security, service-panel, mounting, harsh-weather, or unattended-operation claims.",
  };
}

export function buildHomelineProductUpdate(input: NewProductInput): UpdateProductInput {
  return {
    productName: input.productName,
    displayName: input.displayName,
    slug: input.slug,
    sku: input.sku,
    modelNumber: input.modelNumber,
    shortDescription: input.shortDescription,
    fullDescription: input.fullDescription,
    productType: input.productType,
    productFamily: input.productFamily,
    categoryIds: input.categoryIds,
    manufacturerId: input.manufacturerId,
    brandReference: input.brandReference,
    primarySiteId: input.primarySiteId,
    assignedSiteIds: input.assignedSiteIds,
    siteAssignments: input.siteAssignments,
    media: input.media,
    documents: input.documents,
    specifications: input.specifications,
    seoProfileReference: input.seoProfileReference,
    promptProfileReference: input.promptProfileReference,
    sourceEvidenceReference: input.sourceEvidenceReference,
    authorityProvenance: input.authorityProvenance,
    notes: input.notes,
    lifecycleState: "active",
    catalogStatus: "ready",
    enabled: true,
    visibility: "public_candidate",
  };
}

export function homelineProductRequiresUpdate(product: ProductConfiguration, patch: UpdateProductInput): boolean {
  const current = product as unknown as Record<string, unknown>;
  return Object.entries(patch).some(([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value));
}

export function buildFanCooledProductInput(normalizedAt: string): NewProductInput {
  const common = { sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl, confidence: 1, visibility: "public" as const };
  return {
    organizationId: "ssi", productName: "Fan Cooled Projector Enclosures", displayName: "Fan Cooled Projector Enclosures",
    slug: "fan-cooled-projector-enclosures", sku: "WP-PROJECTORENCLOSURE-10541", modelNumber: null,
    shortDescription: "Fan-cooled projector protection for indoor, covered outdoor, and mild-environment commercial AV installations.",
    fullDescription: "Projector enclosures with built-in fan cooling, durable metal construction, and removable or hinged access panels.",
    productType: "projector_enclosure", productFamily: "Fan Cooled Projector Enclosures", categoryIds: ["cat-ssi-projector-enclosures"],
    manufacturerId: "mfr-ssi-projector-enclosures", brandReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand,
    primarySiteId: PROJECTOR_ENCLOSURE_SITE_ID, assignedSiteIds: [PROJECTOR_ENCLOSURE_SITE_ID],
    siteAssignments: [{ siteId: PROJECTOR_ENCLOSURE_SITE_ID, enabledForSite: true, siteSpecificSlug: "fan-cooled-projector-enclosures",
      siteSpecificDisplayName: "Fan Cooled Projector Enclosures", siteSpecificShortDescription: null, visibility: "public_candidate", featured: false,
      sortOrder: 0, categoryIds: ["cat-ssi-projector-enclosures"], defaultContentType: "product_update", publicationStatus: "ready",
      seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
      imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image, pricingDisplayMode: "hidden", lastReadinessEvaluation: normalizedAt, lastPublicationReference: null }],
    media: { primaryImageReference: "wordpress-media:10757", galleryImageReferences: [], videoReferences: [] },
    documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
    specifications: [
      { specificationId: "spec-projectorenclosure-cooling", specificationGroup: "Protection", key: "cooling_method", displayLabel: "Cooling Method", rawValue: "Built-In Fan Cooling", normalizedValue: "Fan Cooled", unit: null, sortOrder: 1, ...common },
      { specificationId: "spec-projectorenclosure-construction", specificationGroup: "Construction", key: "construction", displayLabel: "Construction", rawValue: "Durable Metal Construction", normalizedValue: "Metal", unit: null, sortOrder: 2, ...common },
      { specificationId: "spec-projectorenclosure-access", specificationGroup: "Service", key: "service_access", displayLabel: "Service Access", rawValue: "Removable or hinged access panels", normalizedValue: null, unit: null, sortOrder: 3, ...common },
    ],
    seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt,
    businessGenomeObjectReference: null, sourceEvidenceReference: `wordpress-page:10541:${sourceUrl}`,
    authorityProvenance: { sourceType: "OWNER_APPROVED_CANONICAL_PRODUCT", authorityReference: "wordpress-page:10541", normalizationVersion: "fan-cooled-canonical-source-v1", normalizedAt },
    notes: "Canonical WordPress page 10541 authority. Do not infer ratings, weather guarantees, security, compatibility, thermal sizing, filters, insulation, mounting, or other unverified features.",
  };
}

function fanCooledProductMatchesAuthority(product: ProductConfiguration): boolean {
  const specifications = product.specifications.map((specification) => ({
    key: specification.key,
    rawValue: specification.rawValue,
    normalizedValue: specification.normalizedValue,
    sourceReference: specification.sourceReference,
    evidenceReference: specification.evidenceReference,
  }));
  return product.organizationId === "ssi"
    && product.productId === PROJECTOR_ENCLOSURE_PRODUCT_ID
    && product.productName === "Fan Cooled Projector Enclosures"
    && product.slug === "fan-cooled-projector-enclosures"
    && product.sku === "WP-PROJECTORENCLOSURE-10541"
    && product.primarySiteId === PROJECTOR_ENCLOSURE_SITE_ID
    && product.assignedSiteIds.length === 1
    && product.assignedSiteIds[0] === PROJECTOR_ENCLOSURE_SITE_ID
    && product.media.primaryImageReference === "wordpress-media:10757"
    && product.sourceEvidenceReference === `wordpress-page:10541:${sourceUrl}`
    && product.authorityProvenance?.sourceType === "OWNER_APPROVED_CANONICAL_PRODUCT"
    && product.authorityProvenance.authorityReference === "wordpress-page:10541"
    && product.authorityProvenance.normalizationVersion === "fan-cooled-canonical-source-v1"
    && product.lifecycleState === "active"
    && product.catalogStatus === "ready"
    && product.enabled
    && product.visibility === "public_candidate"
    && JSON.stringify(specifications) === JSON.stringify([
      { key: "cooling_method", rawValue: "Built-In Fan Cooling", normalizedValue: "Fan Cooled", sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl },
      { key: "construction", rawValue: "Durable Metal Construction", normalizedValue: "Metal", sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl },
      { key: "service_access", rawValue: "Removable or hinged access panels", normalizedValue: null, sourceReference: "wordpress-page:10541", evidenceReference: sourceUrl },
    ]);
}

export function restoreMissingFanCooledProductAuthority(normalizedAt: string): { product: ProductConfiguration; created: boolean } {
  reloadProductRepositoryFromPersistence();
  const existing = getProductById(PROJECTOR_ENCLOSURE_PRODUCT_ID);
  if (existing) {
    if (!fanCooledProductMatchesAuthority(existing)) throw new Error("Existing Fan Cooled product does not match canonical authority.");
    return { product: existing, created: false };
  }
  const categories = listCategories().filter((category) => category.categoryId === "cat-ssi-projector-enclosures");
  const manufacturers = listManufacturers().filter((manufacturer) => manufacturer.manufacturerId === "mfr-ssi-projector-enclosures");
  if (categories.length !== 1 || categories[0].organizationId !== "ssi" || categories[0].name !== "Projector Enclosures" || categories[0].slug !== "projector-enclosures") throw new Error("Exact ProjectorEnclosure category authority is required.");
  if (manufacturers.length !== 1 || manufacturers[0].organizationId !== "ssi" || manufacturers[0].name !== "Screen Solutions International" || manufacturers[0].website !== "https://projectorenclosure.com") throw new Error("Exact ProjectorEnclosure manufacturer authority is required.");
  const created = createProduct(buildFanCooledProductInput(normalizedAt));
  if (!created.validation.valid || !created.product) throw new Error("Fan Cooled product authority creation failed.");
  const activated = updateProduct(PROJECTOR_ENCLOSURE_PRODUCT_ID, { lifecycleState: "active", catalogStatus: "ready", enabled: true, visibility: "public_candidate" });
  if (!activated.validation.valid || !activated.product) throw new Error("Fan Cooled product authority activation failed.");
  return { product: activated.product, created: true };
}

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

  restoreMissingFanCooledProductAuthority(new Date().toISOString());

  let homelineProduct = getProductById(HOMELINE_PRODUCT_ID);
  const homelineNormalizedAt = homelineProduct?.authorityProvenance?.normalizationVersion === "homeline-owner-approved-v1"
    ? homelineProduct.authorityProvenance.normalizedAt
    : new Date().toISOString();
  const homelineInput = buildHomelineProductInput(homelineNormalizedAt);
  if (!homelineProduct) {
    const created = createProduct(homelineInput);
    if (!created.validation.valid || !created.product) throw new Error("Homeline product creation failed.");
    homelineProduct = created.product;
  }

  const siteResult = updateSite(PROJECTOR_ENCLOSURE_SITE_ID, { enabled: true, lifecycleState: "active", healthStatus: "healthy", publishingStatus: "ready",
    integrations: { ...site.integrations, workflowReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.workflow },
    profiles: { promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt, imageProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.image,
      seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, brandProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.brand, analyticsProfileReference: null } });
  if (!siteResult.validation.valid || !siteResult.site) throw new Error("ProjectorEnclosure site activation failed.");
  const productResult = updateProduct(PROJECTOR_ENCLOSURE_PRODUCT_ID, { lifecycleState: "active", catalogStatus: "ready", enabled: true,
    visibility: "public_candidate", seoProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.seo, promptProfileReference: PROJECTOR_ENCLOSURE_PROFILE_IDS.prompt });
  if (!productResult.validation.valid || !productResult.product) throw new Error("ProjectorEnclosure product activation failed.");
  const homelinePatch = buildHomelineProductUpdate(homelineInput);
  const homelineResult = homelineProductRequiresUpdate(homelineProduct, homelinePatch)
    ? updateProduct(HOMELINE_PRODUCT_ID, homelinePatch)
    : { validation: { valid: true, issues: [] }, product: homelineProduct };
  if (!homelineResult.validation.valid || !homelineResult.product) throw new Error("Homeline product activation failed.");

  return {
    site: siteResult.site, product: productResult.product, homelineProduct: homelineResult.product, profileReadiness,
    siteReadiness: evaluateSiteReadiness({ site: siteResult.site, organizationActive: true, requiredPermission: "sites:manage_integrations", permissions, intent: "publish", requireWorkflowReference: true }),
    productReadiness: evaluateProductReadiness({ product: productResult.product, requiredPermission: "products:evaluate_readiness", permissions }),
    homelineProductReadiness: evaluateProductReadiness({ product: homelineResult.product, requiredPermission: "products:evaluate_readiness", permissions }),
  };
}