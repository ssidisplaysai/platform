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
import { createSite, getSiteById, updateSite } from "./site-repository";
import { evaluateSiteReadiness } from "./site-readiness";
import { findStoredWordPressCredentialReferenceForSite } from "./wordpress-credential-store";
import type {
  IntegrationProfileReferenceSet,
  IntegrationProfileType,
  NewIntegrationProfileInput,
  PermissionAction,
} from "./types";

export const SSI_SITE_ID = "site-ssi-screen-solutions-international";
export const SSI_PRODUCT_ID = "prod-ssi-accent-rear-projection-film";

export const SSI_PROFILE_IDS = {
  brand: "profile-brand-ssi-default",
  wordpress: "profile-wordpress-ssi-default",
  publishing: "profile-publishing-ssi-default",
  seo: "profile-seo-ssi-default",
  prompt: "profile-prompt-ssi-commercial-product",
  image: "profile-image-ssi-product",
  workflow: "profile-workflow-ssi-site-studio",
} as const;

function references(
  values: Partial<IntegrationProfileReferenceSet>,
): IntegrationProfileReferenceSet {
  return {
    credentialReference: null,
    workflowReference: null,
    promptReference: null,
    providerReference: null,
    brandReference: null,
    workflowProfileReference: null,
    wordpressProfileReference: null,
    promptProfileReference: null,
    imageProfileReference: null,
    seoProfileReference: null,
    analyticsProfileReference: null,
    titleStrategyReference: null,
    metaStrategyReference: null,
    schemaReference: null,
    openGraphReference: null,
    slugStrategyReference: null,
    canonicalPolicyReference: null,
    logoReference: null,
    colorPaletteReference: null,
    typographyReference: null,
    voiceReference: null,
    defaultCtaReference: null,
    assetReference: null,
    baseUrlReference: null,
    authorReference: null,
    categoryReference: null,
    postStatusReference: null,
    featuredImagePolicyReference: null,
    imageInsertionPolicyReference: null,
    yoastPolicyReference: null,
    inputContractReference: null,
    outputContractReference: null,
    retryPolicyReference: null,
    executionTimeoutReference: null,
    environmentReference: null,
    ...values,
  };
}

function profile(
  profileType: IntegrationProfileType,
  profileId: string,
  profileName: string,
  profileReferences: Partial<IntegrationProfileReferenceSet>,
): NewIntegrationProfileInput {
  return {
    profileId,
    profileType,
    organizationId: "ssi",
    profileName,
    description: `SSI-owned ${profileType} authority for Genesis Site Studio.`,
    status: "active",
    enabled: true,
    version: "1.0.0",
    assignedSiteIds: [SSI_SITE_ID],
    defaultForOrganization: true,
    references: references(profileReferences),
    notes: "References only; no credential values or generated product claims.",
  };
}

const SSI_PROFILES: readonly NewIntegrationProfileInput[] = [
  profile("brand", SSI_PROFILE_IDS.brand, "SSI Brand Default", {
    logoReference: "wordpress-media-ssi-site-logo",
    colorPaletteReference: "ssi-site-current-palette",
    typographyReference: "ssi-site-current-typography",
    voiceReference: "ssi-existing-product-content-voice",
    defaultCtaReference: "ssi-site-contact-action",
  }),
  profile("wordpress", SSI_PROFILE_IDS.wordpress, "SSI WordPress Default", {
    credentialReference: "ssi-site-wordpress-authority",
    providerReference: "provider-wordpress",
    baseUrlReference: "https://ssidisplays.com/wp-json/wp/v2",
    postStatusReference: "poststatus-draft",
    featuredImagePolicyReference: "feature-image-required",
    yoastPolicyReference: "yoast-ssi-default",
    environmentReference: "environment-production",
  }),
  profile("workflow", SSI_PROFILE_IDS.workflow, "SSI Site Studio Workflow", {
    workflowReference: "workflowref-site-studio-exact-job-publication-v1",
    providerReference: "provider-genesis-site-studio",
    retryPolicyReference: "retrypolicy-fail-closed-manual-review",
    executionTimeoutReference: "timeout-policy-30s",
    inputContractReference: "contractref-site-studio-job-input-v1",
    outputContractReference: "contractref-site-studio-job-output-v1",
    environmentReference: "environment-production",
  }),
  profile("prompt", SSI_PROFILE_IDS.prompt, "SSI Commercial Product Prompt", {
    promptReference: "promptref-ssi-existing-product-content-v1",
    providerReference: "provider-openai-text",
    brandReference: SSI_PROFILE_IDS.brand,
  }),
  profile("image", SSI_PROFILE_IDS.image, "SSI Product Media", {
    promptReference: "imgpromptref-ssi-product-context-v1",
    providerReference: "provider-openai-image",
    brandReference: SSI_PROFILE_IDS.brand,
    featuredImagePolicyReference: "feature-image-required",
  }),
  profile("seo", SSI_PROFILE_IDS.seo, "SSI SEO Default", {
    brandReference: SSI_PROFILE_IDS.brand,
    titleStrategyReference: "titlestrategy-ssi-product-location-v1",
    metaStrategyReference: "metastrategy-ssi-product-location-v1",
    schemaReference: "schemaref-ssi-service-page-v1",
    openGraphReference: "ogref-ssi-default-v1",
    slugStrategyReference: "slugstrategy-ssi-hierarchy-v1",
    canonicalPolicyReference: "canonical-policy-site-primary",
    yoastPolicyReference: "wordpress-rest:/ssi/v1/yoast-update",
  }),
  profile("publishing", SSI_PROFILE_IDS.publishing, "SSI Publishing Default", {
    wordpressProfileReference: SSI_PROFILE_IDS.wordpress,
    workflowProfileReference: SSI_PROFILE_IDS.workflow,
    promptProfileReference: SSI_PROFILE_IDS.prompt,
    imageProfileReference: SSI_PROFILE_IDS.image,
    seoProfileReference: SSI_PROFILE_IDS.seo,
  }),
];

const ALL_PERMISSIONS = new Set<PermissionAction>([
  "sites:manage_integrations",
  "products:evaluate_readiness",
]);

export function ensureSsiSiteRecord() {
  const existing = getSiteById(SSI_SITE_ID);
  if (existing) return existing;
  const credentialReference = findStoredWordPressCredentialReferenceForSite({
    organizationId: "ssi",
    siteId: SSI_SITE_ID,
  });
  if (!credentialReference) {
    throw new Error("Existing SSI site-owned WordPress credential reference was not found.");
  }
  const created = createSite({
    organizationId: "ssi",
    siteName: "Screen Solutions International",
    displayName: "SSI Displays",
    slug: "screen-solutions-international",
    domain: "ssidisplays.com",
    primaryAddress: null,
    canonicalUrl: "https://ssidisplays.com",
    environment: "production",
    enabled: false,
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: "https://ssidisplays.com/wp-json/wp/v2",
      wordpressCredentialReference: credentialReference,
      workflowReference: null,
    },
    profiles: {
      promptProfileReference: null,
      imageProfileReference: null,
      seoProfileReference: null,
      brandProfileReference: null,
      analyticsProfileReference: null,
    },
    notes: "Restored from SSI onboarding preset and site-owned credential authority.",
  });
  if (!created.validation.valid || !created.site) {
    throw new Error("SSI site restoration validation failed.");
  }
  return created.site;
}

function ssiSpecifications() {
  const source = "https://ssidisplays.com/accent-rear-projection-film/";
  return [
    { specificationId: "spec-ssi-accent-screen-color", specificationGroup: "Optical", key: "screen_color", displayLabel: "Screen Color", rawValue: "Frosted White", normalizedValue: "Frosted White", unit: null, sortOrder: 1, sourceReference: "wordpress-page:6285", evidenceReference: source, confidence: 1, visibility: "public" as const },
    { specificationId: "spec-ssi-accent-light-transmission", specificationGroup: "Optical", key: "light_transmission", displayLabel: "Transmission of Light", rawValue: "79%", normalizedValue: "79", unit: "%", sortOrder: 2, sourceReference: "wordpress-page:6285", evidenceReference: source, confidence: 1, visibility: "public" as const },
    { specificationId: "spec-ssi-accent-viewing-angle", specificationGroup: "Optical", key: "maximum_viewing_angle", displayLabel: "Maximum Viewing Angle", rawValue: "175 degrees", normalizedValue: "175", unit: "degrees", sortOrder: 3, sourceReference: "wordpress-page:6285", evidenceReference: source, confidence: 1, visibility: "public" as const },
  ];
}

function ensureSsiProduct() {
  const existing = getProductById(SSI_PRODUCT_ID);
  if (existing) return existing;
  if (!listCategories().some((category) => category.categoryId === "cat-ssi-projection-films")) {
    const category = createCategory({
      organizationId: "ssi",
      name: "Projection Films",
      slug: "projection-films",
      description: "SSI rear projection film products.",
      parentCategoryId: null,
      sortOrder: 1,
      siteAssignments: [SSI_SITE_ID],
    });
    if (!category.validation.valid || !category.category) {
      throw new Error("SSI projection-film category restoration failed.");
    }
  }
  const created = createProduct({
    organizationId: "ssi",
    productName: "Accent Rear Projection Film",
    displayName: "Accent Rear Projection Film",
    slug: "accent-rear-projection-film",
    sku: "WP-SSI-SCREEN-SOLUTIONS-INT-6285",
    modelNumber: null,
    shortDescription: "Ultra bright, high-definition frosted-white rear projection film.",
    fullDescription: "Rear projection film for glass applications, compatible with most projector makes and models and available in standard or custom sizes.",
    productType: "projection_film",
    productFamily: "Projection Films",
    categoryIds: ["cat-ssi-projection-films"],
    manufacturerId: "mfr-ssi-internal",
    brandReference: SSI_PROFILE_IDS.brand,
    primarySiteId: SSI_SITE_ID,
    assignedSiteIds: [SSI_SITE_ID],
    siteAssignments: [{
      siteId: SSI_SITE_ID,
      enabledForSite: true,
      siteSpecificSlug: "accent-rear-projection-film",
      siteSpecificDisplayName: "Accent Rear Projection Film",
      siteSpecificShortDescription: null,
      visibility: "public_candidate",
      featured: false,
      sortOrder: 0,
      categoryIds: ["cat-ssi-projection-films"],
      defaultContentType: "product",
      publicationStatus: "ready",
      seoProfileReference: SSI_PROFILE_IDS.seo,
      promptProfileReference: SSI_PROFILE_IDS.prompt,
      imageProfileReference: SSI_PROFILE_IDS.image,
      pricingDisplayMode: "hidden",
      lastReadinessEvaluation: new Date().toISOString(),
      lastPublicationReference: null,
    }],
    media: { primaryImageReference: "wordpress-media:2608", galleryImageReferences: [], videoReferences: [] },
    documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
    specifications: ssiSpecifications(),
    seoProfileReference: SSI_PROFILE_IDS.seo,
    promptProfileReference: SSI_PROFILE_IDS.prompt,
    businessGenomeObjectReference: null,
    sourceEvidenceReference: "wordpress-page:6285:https://ssidisplays.com/accent-rear-projection-film/",
    notes: "Approved from authenticated SSI WordPress product authority.",
  });
  if (!created.validation.valid || !created.product) {
    throw new Error(`SSI product restoration failed: ${created.validation.issues.map((issue) => issue.message).join("; ")}`);
  }
  return created.product;
}

export function configureSsiSiteStudio() {
  ensureSsiSiteRecord();

  createManufacturer({
    manufacturerId: "mfr-ssi-internal",
    organizationId: "ssi",
    name: "Screen Solutions International",
    displayName: "Screen Solutions International",
    slug: "screen-solutions-international",
    website: "https://ssidisplays.com",
    status: "active",
    businessGenomeReference: null,
    notes: "Authority: SSI WordPress product page 6285 states SSI produces rear projection films.",
  });

  for (const input of SSI_PROFILES) {
    const existingProfile = getIntegrationProfileById(input.profileId);
    if (!existingProfile) {
      const created = createIntegrationProfile(input);
      if (!created.validation.valid || !created.profile) {
        throw new Error(
          `SSI ${input.profileType} profile validation failed: ${created.validation.issues.map((issue) => issue.message).join("; ")}`,
        );
      }
    } else if (input.profileType === "seo") {
      const updated = updateIntegrationProfile(input.profileId, {
        references: input.references,
      });
      if (!updated.validation.valid || !updated.profile) {
        throw new Error("SSI SEO profile endpoint configuration failed.");
      }
    }

    const assignment = upsertProfileAssignment({
      organizationId: "ssi",
      targetType: "site",
      targetId: SSI_SITE_ID,
      siteId: SSI_SITE_ID,
      profileType: input.profileType,
      profileId: input.profileId,
      notes: "Direct SSI Site Studio assignment.",
    });
    if (!assignment.validation.valid) {
      throw new Error(
        `SSI ${input.profileType} assignment failed: ${assignment.validation.issues.map((issue) => issue.message).join("; ")}`,
      );
    }
  }

  const profileReadiness = SSI_PROFILES.map((input) =>
    evaluateProfileReadiness(input.profileId),
  );
  if (profileReadiness.some((result) => !result?.ready)) {
    throw new Error("One or more SSI integration profiles are not ready.");
  }

  const siteResult = updateSite(SSI_SITE_ID, {
    enabled: true,
    lifecycleState: "active",
    healthStatus: "healthy",
    publishingStatus: "ready",
    integrations: {
      wordpressApiBaseUrl: "https://ssidisplays.com/wp-json/wp/v2",
      wordpressCredentialReference:
        getSiteById(SSI_SITE_ID)?.integrations.wordpressCredentialReference ?? null,
      workflowReference: SSI_PROFILE_IDS.workflow,
    },
    profiles: {
      promptProfileReference: SSI_PROFILE_IDS.prompt,
      imageProfileReference: SSI_PROFILE_IDS.image,
      seoProfileReference: SSI_PROFILE_IDS.seo,
      brandProfileReference: SSI_PROFILE_IDS.brand,
      analyticsProfileReference: null,
    },
  });
  if (!siteResult.validation.valid || !siteResult.site) {
    throw new Error("SSI site activation validation failed.");
  }

  const product = ensureSsiProduct();
  const assignment = product.siteAssignments.find((entry) => entry.siteId === SSI_SITE_ID);
  if (!assignment) throw new Error("SSI product site assignment is missing.");

  const productResult = updateProduct(SSI_PRODUCT_ID, {
    productType: "projection_film",
    manufacturerId: "mfr-ssi-internal",
    shortDescription: "Ultra bright, high-definition frosted-white rear projection film.",
    fullDescription: "Rear projection film for glass applications, compatible with most projector makes and models and available in standard or custom sizes.",
    specifications: ssiSpecifications(),
    media: {
      ...product.media,
      primaryImageReference: "wordpress-media:2608",
    },
    seoProfileReference: SSI_PROFILE_IDS.seo,
    promptProfileReference: SSI_PROFILE_IDS.prompt,
    lifecycleState: "active",
    catalogStatus: "ready",
    enabled: true,
    visibility: "public_candidate",
    siteAssignments: product.siteAssignments.map((entry) =>
      entry.siteId === SSI_SITE_ID
        ? {
            ...entry,
            visibility: "public_candidate",
            publicationStatus: "ready",
            seoProfileReference: SSI_PROFILE_IDS.seo,
            promptProfileReference: SSI_PROFILE_IDS.prompt,
            imageProfileReference: SSI_PROFILE_IDS.image,
            lastReadinessEvaluation: new Date().toISOString(),
          }
        : entry,
    ),
  });
  if (!productResult.validation.valid || !productResult.product) {
    throw new Error("SSI product readiness configuration failed.");
  }

  const siteReadiness = evaluateSiteReadiness({
    site: siteResult.site,
    organizationActive: true,
    requiredPermission: "sites:manage_integrations",
    permissions: ALL_PERMISSIONS,
    intent: "publish",
    requireWorkflowReference: true,
  });
  const productReadiness = evaluateProductReadiness({
    product: productResult.product,
    requiredPermission: "products:evaluate_readiness",
    permissions: ALL_PERMISSIONS,
  });

  return {
    site: siteResult.site,
    product: productResult.product,
    profileReadiness,
    siteReadiness,
    productReadiness,
  };
}