import type { SiteConfiguration } from "@/modules/foundation/types";
import type { GlwGenerationRequest } from "../page-generation";
import { assertPageenginesMutationAuthorityBinding } from "../pageengines-dispatch-authority";

function pageenginesEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GENESIS_PAGEENGINES_ORGANIZATION_ID: "pageengines",
    GENESIS_PAGEENGINES_SITE_ID: "site-pageengines-staging",
    GENESIS_PAGEENGINES_PRODUCT_ID: "prod-pageengines-homepage-service",
    GENESIS_PAGEENGINES_WORKFLOW_PROFILE_REFERENCE: "profile-workflow-pageengines-staging",
    GENESIS_PAGEENGINES_WORDPRESS_CREDENTIAL_REFERENCE: "credref-wp-pageengines-staging",
    GENESIS_PAGEENGINES_WORDPRESS_HOST: "staging.pageengines.com",
    GENESIS_PAGEENGINES_N8N_MCP_WORKFLOW_ID: "PwkflowPageEng001",
    ...overrides,
  };
}

function createPageenginesSiteRecord(): SiteConfiguration {
  return {
    siteId: "site-pageengines-staging",
    organizationId: "pageengines",
    siteName: "PageEngines",
    displayName: "PageEngines",
    slug: "pageengines",
    domain: "staging.pageengines.com",
    primaryAddress: null,
    canonicalUrl: "https://staging.pageengines.com",
    environment: "staging",
    lifecycleState: "active",
    enabled: true,
    healthStatus: "healthy",
    publishingStatus: "ready",
    publicationPolicy: "draft_only",
    defaultContentType: "landing_page",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
      wordpressCredentialReference: "credref-wp-pageengines-staging",
      workflowReference: "profile-workflow-pageengines-staging",
    },
    profiles: {
      promptProfileReference: "profile-prompt-pageengines-homepage",
      imageProfileReference: "profile-image-pageengines-homepage",
      seoProfileReference: "profile-seo-pageengines-homepage",
      brandProfileReference: "profile-brand-pageengines-homepage",
      analyticsProfileReference: "profile-analytics-pageengines-homepage",
    },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    notes: "PageEngines staging authority scope.",
  };
}

function createPageenginesRequest(): GlwGenerationRequest {
  return {
    siteId: "site-pageengines-staging",
    productId: "prod-pageengines-homepage-service",
    pageType: "general_service",
    stateCode: "",
    citySlug: "",
    slug: "homepage",
    title: "PageEngines Platform Homepage",
    seoTitle: "PageEngines Platform | Governed Page Generation",
    metaDescription: "Generate governed, professional WordPress drafts with PageEngines.",
    publicationIntent: "draft",
    plannedOperation: "CREATE_GENERAL",
    wordpressObjectId: null,
    additionalInstructions: "PAGEENGINES_HOMEPAGE_CONTRACT_V1",
    organizationId: "pageengines",
    siteName: "PageEngines",
    siteDomain: "staging.pageengines.com",
    siteCanonicalUrl: "https://staging.pageengines.com",
    wordpressApiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
    productTopic: "PageEngines Homepage Service",
    stateName: null,
    cityName: null,
    canonicalPath: "homepage",
    externalExecutionAllowed: false,
  };
}

describe("PageEngines dispatch authority binding", () => {
  test("accepts exact PageEngines staging scope with draft-only create authority", () => {
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
      environment: pageenginesEnvironment(),
    })).not.toThrow();
  });

  test("rejects cross-site credential scope mismatch", () => {
    const siteRecord = createPageenginesSiteRecord();
    siteRecord.integrations.wordpressCredentialReference = "credref-wp-ledw-prod";
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord,
      environment: pageenginesEnvironment(),
    })).toThrow("credential scope mismatch");
  });

  test("rejects LEDW workflow profile fallback", () => {
    const siteRecord = createPageenginesSiteRecord();
    siteRecord.integrations.workflowReference = "profile-workflow-ledw-default";
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord,
      environment: pageenginesEnvironment(),
    })).toThrow("workflow profile mismatch");
  });

  test("rejects non-draft or update authority for first homepage generation", () => {
    const updateRequest: GlwGenerationRequest = {
      ...createPageenginesRequest(),
      plannedOperation: "UPDATE_GENERAL",
      wordpressObjectId: "123",
      publicationIntent: "publish",
    };
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: updateRequest,
      siteRecord: createPageenginesSiteRecord(),
      environment: pageenginesEnvironment(),
    })).toThrow("non-draft publication intent");
  });

  test("fails closed when PageEngines scope is requested but authority configuration is missing", () => {
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
      environment: {},
    })).toThrow("PageEngines authority binding is incomplete");
  });

  test("does not block non-PageEngines requests when PageEngines configuration is absent", () => {
    const request: GlwGenerationRequest = {
      ...createPageenginesRequest(),
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      siteName: "LED Display Warehouse",
      siteDomain: "leddisplaywarehouse.com",
      siteCanonicalUrl: "https://leddisplaywarehouse.com",
      wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2",
      productTopic: "Indoor LED Video Wall",
    };
    const siteRecord: SiteConfiguration = {
      ...createPageenginesSiteRecord(),
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      siteName: "LED Display Warehouse",
      displayName: "LEDDisplayWarehouse.com",
      slug: "led-display-warehouse",
      domain: "leddisplaywarehouse.com",
      canonicalUrl: "https://leddisplaywarehouse.com",
      integrations: {
        wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2",
        wordpressCredentialReference: "LED_COMPANY_CREDENTIAL_REFERENCE",
        workflowReference: "profile-workflow-ledw-default",
      },
    };
    expect(() => assertPageenginesMutationAuthorityBinding({
      request,
      siteRecord,
      environment: {},
    })).not.toThrow();
  });
});

