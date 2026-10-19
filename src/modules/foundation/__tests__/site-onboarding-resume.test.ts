import type { SiteConfiguration } from "../types";
import { resolveOnboardingResumeStep, isOnboardingResumable } from "../site-onboarding-resume";

function baseSite(): SiteConfiguration {
  return {
    siteId: "site-pageengines-pageengines-staging",
    organizationId: "pageengines",
    siteName: "PageEngines Staging",
    displayName: "PageEngines",
    slug: "pageengines-staging",
    domain: "staging.pageengines.com",
    primaryAddress: {
      addressLine1: "100 Main St",
      addressLine2: null,
      city: "Dallas",
      stateRegion: "TX",
      postalCode: "75001",
      countryCode: "US",
    },
    canonicalUrl: "https://staging.pageengines.com",
    onboarding: {
      status: "not_started",
      wordpressConnectionVerifiedAt: null,
      certificationStatus: "not_started",
      certificationPageId: null,
      certificationUrl: null,
      certifiedAt: null,
    },
    environment: "staging",
    lifecycleState: "configuring",
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
      wordpressCredentialReference: null,
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
    notes: "Existing WordPress onboarding through GLW.",
  };
}

describe("site onboarding resume step resolution", () => {
  test("resumes at step 3 before WordPress credentials are configured", () => {
    const site = baseSite();
    expect(resolveOnboardingResumeStep(site)).toBe(3);
    expect(isOnboardingResumable(site)).toBe(true);
  });

  test("resumes at step 4 after WordPress connection but before profile + workflow configuration", () => {
    const site = baseSite();
    site.integrations.wordpressCredentialReference = "wpcred-pageengines";
    site.onboarding = {
      ...site.onboarding!,
      status: "connected",
      wordpressConnectionVerifiedAt: "2026-10-16T01:00:00.000Z",
    };

    expect(resolveOnboardingResumeStep(site)).toBe(4);
    expect(isOnboardingResumable(site)).toBe(true);
  });

  test("marks onboarding complete at step 5 once required profiles and workflow are persisted", () => {
    const site = baseSite();
    site.integrations.wordpressCredentialReference = "wpcred-pageengines";
    site.integrations.workflowReference = "profile-workflow-pageengines-default";
    site.onboarding = {
      ...site.onboarding!,
      status: "connected",
      wordpressConnectionVerifiedAt: "2026-10-16T01:00:00.000Z",
    };
    site.profiles = {
      ...site.profiles,
      seoProfileReference: "profile-seo-pageengines-default",
      promptProfileReference: "profile-prompt-pageengines-default",
      imageProfileReference: "profile-image-pageengines-default",
      brandProfileReference: "profile-brand-pageengines-default",
    };

    expect(resolveOnboardingResumeStep(site)).toBe(5);
    expect(isOnboardingResumable(site)).toBe(false);
  });
});

