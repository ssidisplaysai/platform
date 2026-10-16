import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import type { SiteConfiguration, IntegrationProfileConfiguration, ProductConfiguration } from "@/modules/foundation/types";
import type { GlwGenerationRequest } from "../page-generation";
import { assertPageenginesMutationAuthorityBinding } from "../pageengines-dispatch-authority";

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: jest.fn(),
}));
jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: jest.fn(),
}));
jest.mock("@/modules/foundation/integration-profile-repository", () => ({
  getIntegrationProfileById: jest.fn(),
}));

import { getSiteById } from "@/modules/foundation/site-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getIntegrationProfileById } from "@/modules/foundation/integration-profile-repository";

const mockedGetSiteById = getSiteById as jest.MockedFunction<typeof getSiteById>;
const mockedGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;
const mockedGetIntegrationProfileById = getIntegrationProfileById as jest.MockedFunction<typeof getIntegrationProfileById>;

function pageenginesEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GENESIS_PAGEENGINES_WORDPRESS_HOST: "staging.pageengines.com",
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

function createPageenginesProduct(): ProductConfiguration {
  return {
    ...FOUNDATION_PRODUCTS[0],
    productId: "prod-pageengines-homepage-service",
    organizationId: "pageengines",
    productName: "PageEngines Homepage Service",
    displayName: "PageEngines Homepage Service",
    slug: "pageengines-homepage-service",
    sku: "PE-HOMEPAGE-001",
    primarySiteId: "site-pageengines-staging",
    assignedSiteIds: ["site-pageengines-staging"],
  };
}

function createPageenginesWorkflowProfile(): IntegrationProfileConfiguration {
  return {
    profileId: "profile-workflow-pageengines-staging",
    profileType: "workflow",
    organizationId: "pageengines",
    profileName: "PageEngines Staging Workflow",
    description: "Scoped workflow profile for PageEngines staging.",
    status: "active",
    enabled: true,
    version: "1.0.0",
    assignedSiteIds: ["site-pageengines-staging"],
    defaultForOrganization: false,
    references: {
      credentialReference: "credref-wp-pageengines-staging",
      workflowReference: "PwkflowPageEng001",
      promptReference: null,
      providerReference: "provider-n8n",
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
    },
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    notes: null,
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
    additionalInstructions: "PAGEENGINES_HOMEPAGE_CONTRACT_V1; distinctive hero section; platform positioning; responsive mobile and desktop layout; clear CTAs; no fabricated results.",
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
  beforeEach(() => {
    mockedGetSiteById.mockReturnValue(createPageenginesSiteRecord());
    mockedGetProductById.mockReturnValue(createPageenginesProduct());
    mockedGetIntegrationProfileById.mockReturnValue(createPageenginesWorkflowProfile());
  });

  test("accepts exact PageEngines staging scope with draft-only create authority", () => {
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
      environment: pageenginesEnvironment(),
    })).not.toThrow();
  });

  test("rejects cross-site credential scope mismatch", () => {
    mockedGetIntegrationProfileById.mockReturnValue({
      ...createPageenginesWorkflowProfile(),
      references: {
        ...createPageenginesWorkflowProfile().references,
        credentialReference: "credref-wp-ledw-prod",
      },
    });
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
      environment: pageenginesEnvironment(),
    })).toThrow("credential scope mismatch");
  });

  test("rejects LEDW workflow profile fallback", () => {
    mockedGetIntegrationProfileById.mockReturnValue({
      ...createPageenginesWorkflowProfile(),
      organizationId: "led-display-warehouse",
    });
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
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

  test("fails closed when PageEngines scope is requested but site authority is missing", () => {
    mockedGetSiteById.mockReturnValue(null);
    expect(() => assertPageenginesMutationAuthorityBinding({
      request: createPageenginesRequest(),
      siteRecord: createPageenginesSiteRecord(),
      environment: {},
    })).toThrow("missing site foundation record");
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
