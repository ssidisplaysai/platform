import {
  applyAutoPreparedProfileOverrides,
  buildNewProfileFromAutoPreparedProposal,
  createAutoPreparedProfilesPreview,
} from "../onboarding-auto-profile-preparation";
import type { IntegrationProfileConfiguration, SiteConfiguration } from "../types";

function siteFixture(): SiteConfiguration {
  return {
    siteId: "site-pageengines-pageengines-staging",
    organizationId: "pageengines",
    siteName: "PageEngines",
    displayName: "PageEngines",
    slug: "pageengines-staging",
    domain: "staging.pageengines.com",
    primaryAddress: null,
    canonicalUrl: "https://staging.pageengines.com",
    environment: "staging",
    lifecycleState: "connected",
    enabled: false,
    healthStatus: "healthy",
    publishingStatus: "disabled",
    publicationPolicy: "draft_only",
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
      wordpressCredentialReference: "credref-wp-pageengines",
      workflowReference: null,
    },
    profiles: {
      promptProfileReference: null,
      imageProfileReference: null,
      seoProfileReference: null,
      brandProfileReference: null,
      analyticsProfileReference: null,
    },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:00.000Z",
    notes: null,
    onboarding: {
      status: "connected",
      wordpressConnectionVerifiedAt: "2026-10-16T00:00:00.000Z",
      certificationStatus: "not_started",
      certificationPageId: null,
      certificationUrl: null,
      certifiedAt: null,
    },
  };
}

function profileFixture(input: {
  profileId: string;
  profileType: IntegrationProfileConfiguration["profileType"];
  profileName: string;
}): IntegrationProfileConfiguration {
  return {
    profileId: input.profileId,
    profileType: input.profileType,
    organizationId: "pageengines",
    profileName: input.profileName,
    description: null,
    status: "active",
    enabled: true,
    version: "1.0.0",
    assignedSiteIds: [],
    defaultForOrganization: false,
    references: {
      credentialReference: null,
      workflowReference: null,
      promptReference: "promptref",
      providerReference: "provider-openai",
      brandReference: null,
      workflowProfileReference: null,
      wordpressProfileReference: null,
      promptProfileReference: null,
      imageProfileReference: null,
      seoProfileReference: null,
      analyticsProfileReference: null,
      titleStrategyReference: "titlestrategy",
      metaStrategyReference: "metastrategy",
      schemaReference: "schema",
      openGraphReference: "og",
      slugStrategyReference: "slug",
      canonicalPolicyReference: "canonical",
      logoReference: "logo",
      colorPaletteReference: "palette",
      typographyReference: "typography",
      voiceReference: "voice",
      defaultCtaReference: "cta",
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
    },
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:00.000Z",
    notes: null,
  };
}

describe("onboarding auto profile preparation", () => {
  test("creates deterministic proposals and keeps workflow pending when absent", () => {
    const preview = createAutoPreparedProfilesPreview({
      site: siteFixture(),
      organizationProfiles: [],
      likedCreativeAssetIds: ["asset-owner-liked-1"],
      eligibleLogoAssets: [{
        assetId: "asset-owner-liked-1",
        fileName: "PageEngines_Neon_Growth_Logo.png",
        mediaType: "image/png",
        classification: "OWNER_SUPPLIED_REFERENCE",
        sentiment: "LIKE",
        notes: "Owner approved for logo use.",
      }],
    });

    expect(preview.proposals).toHaveLength(4);
    expect(preview.proposals.every((proposal) => proposal.mode === "proposed")).toBe(true);
    const brand = preview.proposals.find((proposal) => proposal.profileType === "brand");
    expect(brand?.references.logoReference).toBeNull();
    expect(brand?.references.assetReference).toBe("site-intelligence-asset:asset-owner-liked-1");
    expect(brand?.diagnostics.blockers).toContain("Approved logo authority is required before brand profile can be operationally ready.");
    expect(brand?.instructionBody).toContain("Grow Your Business Where It Matters Most.");
    expect(preview.workflow.configured).toBe(false);
    expect(preview.eligibleLogoAssets).toHaveLength(1);
  });

  test("reuses existing in-scope profile bindings", () => {
    const site = siteFixture();
    site.profiles.brandProfileReference = "profile-brand-pageengines-existing";
    const preview = createAutoPreparedProfilesPreview({
      site,
      organizationProfiles: [
        profileFixture({
          profileId: "profile-brand-pageengines-existing",
          profileType: "brand",
          profileName: "PageEngines Brand Existing",
        }),
      ],
    });

    const brand = preview.proposals.find((proposal) => proposal.profileType === "brand");
    expect(brand?.mode).toBe("existing");
    expect(brand?.existingReason).toContain("Already bound");
  });

  test("applies editable overrides for proposed profiles", () => {
    const preview = createAutoPreparedProfilesPreview({
      site: siteFixture(),
      organizationProfiles: [],
    });
    const updated = applyAutoPreparedProfileOverrides({
      preview,
      overrides: [{
        profileType: "seo",
        profileName: "Custom PageEngines SEO",
        instructionBody: "Custom SEO instruction body",
        references: {
          titleStrategyReference: "titlestrategy-pageengines-custom",
        },
      }],
    });
    const seo = updated.find((proposal) => proposal.profileType === "seo");
    expect(seo?.profileName).toBe("Custom PageEngines SEO");
    expect(seo?.instructionBody).toBe("Custom SEO instruction body");
    expect(seo?.references.titleStrategyReference).toBe("titlestrategy-pageengines-custom");
  });

  test("maps approved logo selection to site-intelligence asset reference", () => {
    const preview = createAutoPreparedProfilesPreview({
      site: siteFixture(),
      organizationProfiles: [],
      eligibleLogoAssets: [{
        assetId: "site-asset-pageengines-logo-approved",
        fileName: "PageEngines_Neon_Growth_Logo.png",
        mediaType: "image/png",
        classification: "OWNER_SUPPLIED_REFERENCE",
        sentiment: "LIKE",
        notes: "Owner approved for logo use.",
      }],
    });
    const updated = applyAutoPreparedProfileOverrides({
      preview,
      overrides: [{
        profileType: "brand",
        selectedLogoAssetId: "site-asset-pageengines-logo-approved",
        logoApprovalConfirmed: true,
      }],
    });
    const brand = updated.find((proposal) => proposal.profileType === "brand");
    expect(brand?.references.logoReference).toBe("site-intelligence-asset:site-asset-pageengines-logo-approved");
    const logoDiagnostic = brand?.diagnostics.references.find((item) => item.key === "logoReference");
    expect(logoDiagnostic?.status).toBe("verified_asset");
  });

  test("builds a creation payload from a proposed profile", () => {
    const preview = createAutoPreparedProfilesPreview({
      site: siteFixture(),
      organizationProfiles: [],
    });
    const brand = preview.proposals.find((proposal) => proposal.profileType === "brand");
    expect(brand).toBeTruthy();
    const input = buildNewProfileFromAutoPreparedProposal({
      organizationId: "pageengines",
      proposal: brand!,
    });

    expect(input.profileType).toBe("brand");
    expect(input.organizationId).toBe("pageengines");
    expect(input.profileName).toContain("PageEngines");
    expect(input.notes).toContain("Positioning: PageEngines is for local-business growth.");
  });
});
