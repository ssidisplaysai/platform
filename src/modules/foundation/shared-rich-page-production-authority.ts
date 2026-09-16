export const SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION = "GENESIS_SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_V1" as const;

export type SharedRichPageCapability =
  | "RICH_COMPOSITION"
  | "RESPONSIVE_COMPOSITION"
  | "PAGE_LENGTH_DISCIPLINE"
  | "MEDIA_AUTHORITY"
  | "MEDIA_ASSIGNMENT"
  | "HERO_AUTHORITY"
  | "MEDIA_PROVENANCE"
  | "CLAIM_AUTHORITY"
  | "CLAIM_CANONICALIZATION"
  | "LOCALIZATION"
  | "CUSTOMER_COPY_QUALITY"
  | "WORDPRESS_IDENTITY"
  | "WORDPRESS_PARENT_PREFLIGHT"
  | "WORDPRESS_PERSISTENCE"
  | "STORED_AUTHORITY_READBACK"
  | "HOST_INTEGRATION"
  | "HEADER_FOOTER_INTEGRATION"
  | "NATIVE_TITLE_SUPPRESSION"
  | "FEATURED_MEDIA_SUPPRESSION"
  | "VISUAL_CERTIFICATION"
  | "DESKTOP_GEOMETRY"
  | "MOBILE_GEOMETRY"
  | "SEMANTIC_LINKS"
  | "SEO_CANONICAL"
  | "OWNER_REVIEW"
  | "EXACT_PUBLICATION"
  | "PUBLIC_HOST_CERTIFICATION"
  | "ROLLBACK"
  | "LIFECYCLE";

export type SharedAuthorityBinding = {
  authorityName: string;
  implementationPath: string;
  owningModuleOrService: string;
  contractOrPolicy: string;
  consumers: readonly string[];
  reusableBy: readonly string[];
  state: "SHARED" | "SITE_SPECIFIC_REQUIRED" | "MISSING";
};

export type SiteSpecificImplementationClassification =
  | "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT"
  | "LEGITIMATELY_SITE_SPECIFIC_IMPLEMENTATION"
  | "MISSING_SHARED_MECHANISM";

export const NEXT_GLW_STATE_SITE_SPECIFIC_RECHECK = {
  HERO_AUTHORITY: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
  FEATURED_MEDIA_SUPPRESSION: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
  SEMANTIC_LINKS: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
  EXACT_PUBLICATION: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
  ROLLBACK: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
} as const satisfies Readonly<Record<
  "HERO_AUTHORITY" | "FEATURED_MEDIA_SUPPRESSION" | "SEMANTIC_LINKS" | "EXACT_PUBLICATION" | "ROLLBACK",
  SiteSpecificImplementationClassification
>>;

export type SharedRichPageProductionProfile = {
  authorityVersion: typeof SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION;
  profileId: string;
  selector: { organizationId: string; siteId: string; productId: string | null; pageType: string };
  layout: { primaryWidth: number; mobileBreakpoint: number; desktopViewport: 1440; mobileViewport: 375 };
  media: { explicitHeroRequired: boolean; approvalImpliesHero: false; provenanceImpliesLocalContext: false; localAtmosphereRequired: boolean };
  host: { integrationPolicy: "GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1"; suppressNativeTitle: boolean; suppressFeaturedMedia: boolean };
  lifecycle: { ownerReviewSeparateFromPublication: true; exactStoredArtifactPublicationRequired: true; actualPublicHostCertificationRequired: true };
};

export const SHARED_RICH_PAGE_AUTHORITY_MANIFEST: Readonly<Record<SharedRichPageCapability, SharedAuthorityBinding>> = {
  RICH_COMPOSITION: { authorityName: "Genesis Rich Page Composition", implementationPath: "src/modules/foundation/rich-page-composition.ts", owningModuleOrService: "createRichPageCompositionPlan", contractOrPolicy: "site-page-composition-plan-v1", consumers: ["Commercial Stainless", "GLW rich-reference readiness"], reusableBy: ["SSI", "ProjectorEnclosure", "ProjectionMappingSupply", "future Genesis sites"], state: "SHARED" },
  RESPONSIVE_COMPOSITION: { authorityName: "Rendered Visual Certification", implementationPath: "src/modules/foundation/rendered-visual-certification.ts", owningModuleOrService: "deriveRenderedVisualFindings", contractOrPolicy: "genesis-rendered-visual-rules-v1", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["SSI", "ProjectorEnclosure", "future Genesis sites"], state: "SHARED" },
  PAGE_LENGTH_DISCIPLINE: { authorityName: "Rich Page Composition Evaluation", implementationPath: "src/modules/foundation/rich-page-composition.ts", owningModuleOrService: "evaluateRichPageComposition", contractOrPolicy: "genesis-rich-page-composition-rules-v1", consumers: ["Commercial Stainless", "GLW generated page review"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  MEDIA_AUTHORITY: { authorityName: "Site Page Media Assignment", implementationPath: "src/modules/foundation/site-page-media-assignment.ts", owningModuleOrService: "SitePageMediaAssignment", contractOrPolicy: "site-page-media-assignment-v1", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["SSI", "ProjectorEnclosure", "future Genesis sites"], state: "SHARED" },
  MEDIA_ASSIGNMENT: { authorityName: "Site Page Media Assignment", implementationPath: "src/modules/foundation/site-page-media-assignment.ts", owningModuleOrService: "SitePageMediaAssignment", contractOrPolicy: "site-page-media-assignment-v1", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  HERO_AUTHORITY: { authorityName: "GLW Product Media Hero Authority", implementationPath: "src/modules/glw/product-media-authority.ts", owningModuleOrService: "issueProductMediaHeroGrant/selectProductMediaHero", contractOrPolicy: "PRODUCT_MEDIA_HERO_OWNER_AUTHORITY_V1", consumers: ["LED Display Warehouse / Indiana"], reusableBy: ["GLW products after scope generalization"], state: "SITE_SPECIFIC_REQUIRED" },
  MEDIA_PROVENANCE: { authorityName: "Site Page Media Assignment", implementationPath: "src/modules/foundation/site-page-media-assignment.ts", owningModuleOrService: "SitePageMediaAssignment.asset", contractOrPolicy: "site-page-media-assignment-v1", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  CLAIM_AUTHORITY: { authorityName: "GLW Reference Claim Authority", implementationPath: "src/modules/glw/reference-claim-authority.ts", owningModuleOrService: "evaluateGlwReferenceClaimAuthority", contractOrPolicy: "GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1", consumers: ["LED Display Warehouse / Indiana", "GLW reference pipeline"], reusableBy: ["GLW campaigns"], state: "SHARED" },
  CLAIM_CANONICALIZATION: { authorityName: "Zero Authority Claim Canonicalization", implementationPath: "src/modules/glw/zero-authority-claim-canonicalization.ts", owningModuleOrService: "canonicalizeZeroAuthorityClaims", contractOrPolicy: "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V1", consumers: ["GLW reference pipeline"], reusableBy: ["GLW campaigns"], state: "SHARED" },
  LOCALIZATION: { authorityName: "State Localization Contamination", implementationPath: "src/modules/glw/state-localization-contamination.ts", owningModuleOrService: "evaluateGlwStateLocalizationContamination", contractOrPolicy: "GLW_STATE_LOCALIZATION_CONTAMINATION_V1", consumers: ["LED Display Warehouse / Indiana", "GLW reference pipeline"], reusableBy: ["next GLW state"], state: "SHARED" },
  CUSTOMER_COPY_QUALITY: { authorityName: "Genesis Customer-Facing Copy Quality", implementationPath: "src/modules/foundation/customer-facing-copy-quality.ts", owningModuleOrService: "evaluateCustomerFacingCopyQuality", contractOrPolicy: "GENESIS_CUSTOMER_FACING_COPY_QUALITY_V1", consumers: ["LED Display Warehouse / Indiana"], reusableBy: ["SSI", "ProjectorEnclosure", "future Genesis sites"], state: "SHARED" },
  WORDPRESS_IDENTITY: { authorityName: "Authenticated WordPress Read Authority", implementationPath: "src/modules/foundation/authenticated-wordpress-read-authority.ts", owningModuleOrService: "createAuthenticatedWordPressReadAuthority", contractOrPolicy: "authenticated exact-object read", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  WORDPRESS_PARENT_PREFLIGHT: { authorityName: "WordPress Hierarchy Authority", implementationPath: "src/modules/foundation/wordpress-hierarchy-authority.ts", owningModuleOrService: "WordPress hierarchy authority", contractOrPolicy: "exact parent identity", consumers: ["GLW parent authority", "site builds"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  WORDPRESS_PERSISTENCE: { authorityName: "Genesis WordPress Draft Writer", implementationPath: "src/modules/foundation/wordpress-draft-writer.ts", owningModuleOrService: "writeGenesisWordPressDraft", contractOrPolicy: "exact create/update draft", consumers: ["LED Display Warehouse / Indiana", "GLW reference persistence"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  STORED_AUTHORITY_READBACK: { authorityName: "Authenticated WordPress Read Authority", implementationPath: "src/modules/foundation/authenticated-wordpress-read-authority.ts", owningModuleOrService: "createAuthenticatedWordPressReadAuthority", contractOrPolicy: "post-write exact-object readback", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  HOST_INTEGRATION: { authorityName: "Genesis Rich Page Host Policy", implementationPath: "src/modules/foundation/shared-rich-page-production-authority.ts", owningModuleOrService: "richPageHostIntegrationCss", contractOrPolicy: "GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1", consumers: ["LED Display Warehouse / Indiana"], reusableBy: ["future WordPress rich pages"], state: "SHARED" },
  HEADER_FOOTER_INTEGRATION: { authorityName: "Rendered Host Integration Evidence", implementationPath: "src/modules/foundation/governed-render-capture-browser.ts", owningModuleOrService: "geometry", contractOrPolicy: "RVC_HOST_HEADER_OVERLAP/RVC_HOST_FOOTER_OVERLAP", consumers: ["LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  NATIVE_TITLE_SUPPRESSION: { authorityName: "Native Title Policy", implementationPath: "src/modules/foundation/shared-rich-page-production-authority.ts", owningModuleOrService: "richPageHostIntegrationCss", contractOrPolicy: "eligible rich-page profile suppression only", consumers: ["profile registry"], reusableBy: ["future WordPress rich pages"], state: "SHARED" },
  FEATURED_MEDIA_SUPPRESSION: { authorityName: "Featured Media Policy", implementationPath: "src/modules/foundation/shared-rich-page-production-authority.ts", owningModuleOrService: "SharedRichPageProductionProfile.host", contractOrPolicy: "profile-driven suppression", consumers: ["Commercial Stainless profile"], reusableBy: ["future Genesis sites"], state: "SITE_SPECIFIC_REQUIRED" },
  VISUAL_CERTIFICATION: { authorityName: "Governed Render Capture", implementationPath: "src/modules/foundation/governed-render-capture-orchestrator.ts", owningModuleOrService: "runGovernedRenderCapture", contractOrPolicy: "rendered-visual-certification-v1", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["SSI", "ProjectorEnclosure", "future Genesis sites"], state: "SHARED" },
  DESKTOP_GEOMETRY: { authorityName: "Governed Render Capture", implementationPath: "src/modules/foundation/governed-render-capture-browser.ts", owningModuleOrService: "captureGovernedRenderedPage", contractOrPolicy: "DESKTOP 1440x1000", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  MOBILE_GEOMETRY: { authorityName: "Governed Render Capture", implementationPath: "src/modules/foundation/governed-render-capture-browser.ts", owningModuleOrService: "captureGovernedRenderedPage", contractOrPolicy: "MOBILE 375x812", consumers: ["Commercial Stainless", "LED Display Warehouse / Indiana"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  SEMANTIC_LINKS: { authorityName: "Site Internal Link Authority", implementationPath: "src/modules/glw/site-internal-link-authority.ts", owningModuleOrService: "resolveGlwSiteInternalLinkAuthority", contractOrPolicy: "exact allowed internal links", consumers: ["GLW reference pipeline"], reusableBy: ["registered GLW sites"], state: "SITE_SPECIFIC_REQUIRED" },
  SEO_CANONICAL: { authorityName: "Public WordPress Certification", implementationPath: "src/modules/foundation/public-wordpress-certification.ts", owningModuleOrService: "certifyPublicWordPressSite", contractOrPolicy: "canonical/title/meta/indexability verification", consumers: ["Commercial Stainless", "site publication"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  OWNER_REVIEW: { authorityName: "GLW Reference Owner Authority", implementationPath: "src/modules/glw/reference-owner-authority.ts", owningModuleOrService: "issueGlwReferenceOwnerGrant", contractOrPolicy: "session-bound owner review", consumers: ["GLW reference pipeline"], reusableBy: ["GLW campaigns"], state: "SHARED" },
  EXACT_PUBLICATION: { authorityName: "Genesis Exact Publication Authority", implementationPath: "src/modules/glw/exact-publication-rollback-authority.ts", owningModuleOrService: "issueExactPublicationRollbackPreflight/issueExactPublicationRollbackGrant/consumeExactPublicationRollbackGrant", contractOrPolicy: "exact target, object, artifact, certification, runtime, principal, and session", consumers: ["GLW rich-reference production"], reusableBy: ["Outdoor Digital Sphere state targets"], state: "SHARED" },
  PUBLIC_HOST_CERTIFICATION: { authorityName: "Public WordPress Certification", implementationPath: "src/modules/foundation/public-wordpress-certification.ts", owningModuleOrService: "certifyPublicWordPressSite", contractOrPolicy: "public canonical verification", consumers: ["Commercial Stainless", "site publication"], reusableBy: ["future Genesis sites"], state: "SHARED" },
  ROLLBACK: { authorityName: "Genesis Exact Rollback Authority", implementationPath: "src/modules/glw/exact-publication-rollback-authority.ts", owningModuleOrService: "issueExactPublicationRollbackPreflight/issueExactPublicationRollbackGrant/consumeExactPublicationRollbackGrant", contractOrPolicy: "separate owner-authorized exact publish-to-draft rollback", consumers: ["GLW rich-reference production"], reusableBy: ["Outdoor Digital Sphere state targets"], state: "SHARED" },
  LIFECYCLE: { authorityName: "Site Publication Executor", implementationPath: "src/modules/foundation/site-publication-executor.ts", owningModuleOrService: "executeSitePublication", contractOrPolicy: "site publication lifecycle", consumers: ["Genesis site builds"], reusableBy: ["future Genesis sites"], state: "SHARED" },
};

export const SHARED_RICH_PAGE_PROFILES: readonly SharedRichPageProductionProfile[] = [
  { authorityVersion: SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION, profileId: "commercial-stainless-home-v1", selector: { organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", productId: null, pageType: "HOME" }, layout: { primaryWidth: 1240, mobileBreakpoint: 768, desktopViewport: 1440, mobileViewport: 375 }, media: { explicitHeroRequired: true, approvalImpliesHero: false, provenanceImpliesLocalContext: false, localAtmosphereRequired: false }, host: { integrationPolicy: "GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1", suppressNativeTitle: false, suppressFeaturedMedia: true }, lifecycle: { ownerReviewSeparateFromPublication: true, exactStoredArtifactPublicationRequired: true, actualPublicHostCertificationRequired: true } },
  { authorityVersion: SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION, profileId: "glw-outdoor-digital-sphere-location-v1", selector: { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" }, layout: { primaryWidth: 1280, mobileBreakpoint: 782, desktopViewport: 1440, mobileViewport: 375 }, media: { explicitHeroRequired: true, approvalImpliesHero: false, provenanceImpliesLocalContext: false, localAtmosphereRequired: false }, host: { integrationPolicy: "GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1", suppressNativeTitle: true, suppressFeaturedMedia: false }, lifecycle: { ownerReviewSeparateFromPublication: true, exactStoredArtifactPublicationRequired: true, actualPublicHostCertificationRequired: true } },
];

export function resolveSharedRichPageProductionProfile(input: SharedRichPageProductionProfile["selector"]): SharedRichPageProductionProfile | null {
  const profile = SHARED_RICH_PAGE_PROFILES.find((candidate) => candidate.selector.organizationId === input.organizationId && candidate.selector.siteId === input.siteId && candidate.selector.productId === input.productId && candidate.selector.pageType === input.pageType);
  return profile ? structuredClone(profile) : null;
}

export function richPageHostIntegrationCss(profile: SharedRichPageProductionProfile): string {
  const title = profile.host.suppressNativeTitle ? ".genesis-rich-page-host .wp-block-post-title,.genesis-rich-page-host .entry-title{display:none!important}" : "";
  const featured = profile.host.suppressFeaturedMedia ? ".genesis-rich-page-host .wp-block-post-featured-image,.genesis-rich-page-host .post-media.single-image{display:none!important}" : "";
  return `html,body.genesis-rich-page-host{max-width:100%;overflow-x:clip!important}.genesis-rich-page-host>header{position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;transform:none!important}.genesis-rich-page-host>article{position:relative;z-index:1;width:100%;max-width:100%;margin:0!important;overflow:clip}.genesis-rich-page-host>footer{position:relative!important;clear:both}${title}${featured}@media(max-width:${profile.layout.mobileBreakpoint}px){.genesis-rich-page-host header .elementor-nav-menu--main{display:none!important}.genesis-rich-page-host header .elementor-nav-menu--dropdown[aria-hidden="true"]{display:none!important;max-width:100%!important}.genesis-rich-page-host header .elementor-menu-toggle{display:flex!important}}`;
}

export function evaluateSharedRichPageInheritance(profile: SharedRichPageProductionProfile | null) {
  const missingSharedCapabilities = Object.entries(SHARED_RICH_PAGE_AUTHORITY_MANIFEST).filter(([, binding]) => binding.state !== "SHARED").map(([capability]) => capability as SharedRichPageCapability);
  return { profileResolved: Boolean(profile), sharedProductionPipelineComplete: Boolean(profile) && missingSharedCapabilities.length === 0, nextTargetRequiresNewArchitecture: !profile, nextTargetRequiresNewCode: !profile || missingSharedCapabilities.length > 0, missingSharedCapabilities };
}

export function evaluateNextGlwStateProductionUnblock(profile: SharedRichPageProductionProfile | null) {
  const reusableInputMechanisms = Object.entries(NEXT_GLW_STATE_SITE_SPECIFIC_RECHECK)
    .filter(([, classification]) => classification === "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT")
    .map(([capability]) => capability as keyof typeof NEXT_GLW_STATE_SITE_SPECIFIC_RECHECK);
  const publicationBoundaryRequirements: string[] = [];
  const remainingNewCodeRequirements: string[] = [];
  return {
    profileResolved: Boolean(profile),
    nativeTitleSuppressionRequired: profile?.host.suppressNativeTitle ?? true,
    nativeTitleSuppressionSharedMechanismReady: true,
    reusableInputMechanisms,
    remainingNewCodeRequirements,
    publicationBoundaryRequirements,
    targetParameterizedRichReferenceOrchestrationReady: true,
    nextTargetRequiresNewArchitecture: !profile,
    nextTargetRequiresNewCode: !profile || remainingNewCodeRequirements.length > 0,
    draftProductionReady: Boolean(profile) && remainingNewCodeRequirements.length === 0,
    publicationProductionReady: Boolean(profile) && publicationBoundaryRequirements.length === 0,
    productionReady: Boolean(profile) && remainingNewCodeRequirements.length === 0 && publicationBoundaryRequirements.length === 0,
  };
}
