import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import {
  createGlwCanonicalTargetIdentity,
  resolveGlwTargetMutationAvailability,
  resolveGlwTargetPreflight,
  readGlwTargetPreflight,
  type GlwTargetPreflightResult,
} from "../target-preflight";

const identity = createGlwCanonicalTargetIdentity({
  productId: "prod-indoor-led-video-wall",
  productTopic: "Indoor LED Video Wall",
  stateCode: "TX",
  citySlug: "dallas",
  applicationPath: "indoor-led-video-wall/texas/dallas",
  canonicalParentId: "2563",
});

function authorityFromBodies(bodies: unknown[]): AuthenticatedWordPressReadAuthority {
  const queue = [...bodies];
  return {
    getJson: jest.fn(async () => ({
      ok: true as const,
      body: queue.shift(),
      pagination: { total: null, totalPages: null },
    })),
  };
}

function result(state: GlwTargetPreflightResult["state"]): GlwTargetPreflightResult {
  return {
    ...identity,
    state,
    wordpressObjectId: state.startsWith("EXISTS_") ? "3001" : null,
    wordpressStatus: state === "EXISTS_DRAFT" ? "draft" : state === "EXISTS_PUBLISHED" ? "publish" : null,
    wordpressTitle: null,
    wordpressUrl: null,
    source: "WORDPRESS_READ",
    confidence: "AUTHORITATIVE",
  };
}

function request(citySlug = "dallas") {
  const cityName = citySlug === "houston" ? "Houston" : "Dallas";
  return {
    siteId: "site-led-display-warehouse-production",
    productId: "prod-indoor-led-video-wall",
    pageType: "city_service" as const,
    stateCode: "TX",
    citySlug,
    slug: `indoor-led-video-wall/texas/${citySlug}`,
    title: cityName,
    seoTitle: `${cityName} SEO`,
    metaDescription: `${cityName} meta`,
    publicationIntent: "draft" as const,
    organizationId: "org",
    siteName: "LEDDisplayWarehouse.com",
    siteDomain: "example.test",
    siteCanonicalUrl: "https://example.test",
    wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2",
    productTopic: "Indoor LED Video Wall",
    stateName: "Texas",
    cityName,
    canonicalPath: `indoor-led-video-wall/texas/${citySlug}`,
    plannedOperation: "CREATE_CITY" as const,
    wordpressObjectId: null,
    externalExecutionAllowed: false as const,
  };
}

describe("GLW canonical target preflight", () => {
  test("maps the application path to canonical target identity", () => {
    expect(identity).toMatchObject({
      applicationPath: "indoor-led-video-wall/texas/dallas",
      canonicalPath: "indoor-led-video-wall/texas/dallas",
      canonicalProduct: "Indoor LED Video Wall",
      canonicalProductSlug: "indoor-led-video-wall",
      canonicalSlug: "dallas",
      canonicalParentId: "2563",
    });
  });

  test("represents known published Dallas as an existing page", () => {
    expect(resolveGlwTargetPreflight({
      identity,
      wordpressPages: [{ id: 18846, status: "publish", slug: "dallas", parent: 2563 }],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Dallas",
    })).toMatchObject({ state: "EXISTS_PUBLISHED", wordpressObjectId: "18846" });
  });

  test("blocks create and update for a published target", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_PUBLISHED"))).toMatchObject({
      createAvailable: false,
      updateAvailable: false,
      plannedOperation: null,
    });
  });

  test("exposes exact update for an existing draft", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_DRAFT"))).toMatchObject({
      createAvailable: false,
      updateAvailable: true,
      plannedOperation: "UPDATE_CITY",
      wordpressObjectId: "3001",
    });
  });

  test("exposes draft create for a confirmed absent target", () => {
    expect(resolveGlwTargetMutationAvailability(result("ABSENT"))).toMatchObject({
      createAvailable: true,
      updateAvailable: false,
      plannedOperation: "CREATE_CITY",
    });
  });

  test("fails closed for unknown target state", () => {
    expect(resolveGlwTargetMutationAvailability(result("UNKNOWN"))).toMatchObject({
      createAvailable: false,
      updateAvailable: false,
      plannedOperation: null,
    });
  });

  test("uses a durable completed draft as local partial authority", () => {
    const preflight = resolveGlwTargetPreflight({
      identity,
      localExecutions: [{
        jobId: "job", correlationId: "job", executionTransport: "N8N_MCP", organizationId: "org",
        siteId: "site-led-display-warehouse-production", productId: "prod-indoor-led-video-wall",
        productTopic: "Indoor LED Video Wall", state: "Texas", city: "Dallas",
        slug: identity.applicationPath, title: "Draft", seoTitle: "SEO", metaDescription: "Meta",
        publicationIntent: "draft", status: "COMPLETE", externalExecutionId: "1",
        wordpressObjectId: "3001", wordpressUrl: "https://example.test/?page_id=3001",
        wordpressStatus: "draft", errorCode: null, errorMessage: null, requestedPublicationMode: "draft",
        disposition: "CREATED", qaStatus: "COMPLETE", qaChecks: {}, qaFailureReasons: {},
        focusKeyphrase: "key", wordCount: 100, featuredImagePresent: true,
        createdAt: "2026-01-01", dispatchedAt: "2026-01-01", updatedAt: "2026-01-01", completedAt: "2026-01-01",
      }],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Dallas",
    });
    expect(preflight).toMatchObject({ state: "EXISTS_DRAFT", wordpressObjectId: "3001", source: "LOCAL_EXECUTION" });
  });

  test("resolves published product, state, and leaf hierarchy read-only", async () => {
    const authority = authorityFromBodies([
      [{ id: 124, slug: "indoor-led-video-wall", parent: 0, status: "publish" }],
      [{ id: 2563, slug: "texas", parent: 124, status: "publish" }],
      [{ id: 18846, slug: "dallas", parent: 2563, status: "publish" }],
    ]);
    const target = await readGlwTargetPreflight({ request: request(), wordpressReadAuthority: authority, localExecutions: [] });
    expect(target).toMatchObject({
      state: "EXISTS_PUBLISHED",
      wordpressObjectId: "18846",
      canonicalParentId: "2563",
      hierarchy: {
        productParent: { state: "EXISTS_PUBLISHED", wordpressObjectId: "124" },
        stateParent: { state: "EXISTS_PUBLISHED", wordpressObjectId: "2563" },
        leaf: { state: "EXISTS_PUBLISHED", wordpressObjectId: "18846" },
        generationAvailable: true,
      },
    });
  });

  test("reports missing product parent and dependent hierarchy explicitly", async () => {
    const authority = authorityFromBodies([[]]);
    const target = await readGlwTargetPreflight({ request: request("houston"), wordpressReadAuthority: authority, localExecutions: [] });
    expect(target).toMatchObject({
      state: "ABSENT",
      canonicalParentId: null,
      hierarchy: {
        productParent: { state: "ABSENT", wordpressObjectId: null },
        stateParent: { state: "PARENT_ABSENT", wordpressObjectId: null },
        leaf: { state: "PARENT_ABSENT", wordpressObjectId: null },
        generationAvailable: true,
      },
    });
    expect(resolveGlwTargetMutationAvailability(target).createAvailable).toBe(true);
  });

  test("reports missing state parent beneath an existing product parent", async () => {
    const authority = authorityFromBodies([
      [{ id: 124, slug: "indoor-led-video-wall", parent: 0, status: "draft" }],
      [],
    ]);
    const target = await readGlwTargetPreflight({ request: request("houston"), wordpressReadAuthority: authority, localExecutions: [] });
    expect(target).toMatchObject({
      state: "ABSENT",
      hierarchy: {
        productParent: { state: "EXISTS_DRAFT", wordpressObjectId: "124" },
        stateParent: { state: "ABSENT", parentId: "124" },
        leaf: { state: "PARENT_ABSENT" },
        generationAvailable: true,
      },
    });
  });

  test("blocks generation when product hierarchy is ambiguous", async () => {
    const authority = authorityFromBodies([[
      { id: 124, slug: "indoor-led-video-wall", parent: 0, status: "draft" },
      { id: 125, slug: "indoor-led-video-wall", parent: 0, status: "draft" },
    ]]);
    const target = await readGlwTargetPreflight({ request: request("houston"), wordpressReadAuthority: authority, localExecutions: [] });
    expect(target).toMatchObject({
      state: "UNKNOWN",
      hierarchy: { productParent: { state: "AMBIGUOUS" }, generationAvailable: false },
    });
    expect(resolveGlwTargetMutationAvailability(target).createAvailable).toBe(false);
  });

  test("blocks generation when hierarchy status is unsupported", async () => {
    const authority = authorityFromBodies([[
      { id: 124, slug: "indoor-led-video-wall", parent: 0, status: "pending" },
    ]]);
    const target = await readGlwTargetPreflight({ request: request("houston"), wordpressReadAuthority: authority, localExecutions: [] });
    expect(target).toMatchObject({
      state: "UNKNOWN",
      hierarchy: { productParent: { state: "UNSUPPORTED_STATUS" }, generationAvailable: false },
    });
    expect(resolveGlwTargetMutationAvailability(target).createAvailable).toBe(false);
  });

  test("requires exact parent and leaf for a WordPress match", () => {
    expect(resolveGlwTargetPreflight({
      identity,
      wordpressPages: [{ id: 18846, slug: "dallas", parent: 9999, status: "publish" }],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Dallas",
    }).state).toBe("UNKNOWN");
  });

  test("authoritatively exposes create for an absent state target beneath an existing product", async () => {
    const stateRequest = {
      ...request(),
      pageType: "state_service" as const,
      stateCode: "CA",
      stateName: "California",
      citySlug: "",
      cityName: "",
      slug: "indoor-led-video-wall/california",
      title: "Indoor LED Video Wall in California",
      canonicalPath: "indoor-led-video-wall/california",
      plannedOperation: "CREATE_STATE" as const,
    };

    const authority = authorityFromBodies([
      [{ id: 124, slug: "indoor-led-video-wall", parent: 0, status: "publish" }],
      [],
    ]);

    const target = await readGlwTargetPreflight({
      request: stateRequest,
      wordpressReadAuthority: authority,
      localExecutions: [],
    });

    expect(target).toMatchObject({
      state: "ABSENT",
      canonicalSlug: "california",
      canonicalParentId: "124",
      hierarchy: {
        productParent: {
          state: "EXISTS_PUBLISHED",
          wordpressObjectId: "124",
        },
        stateParent: {
          state: "ABSENT",
          parentId: "124",
        },
        leaf: {
          state: "ABSENT",
          parentId: "124",
        },
        generationAvailable: true,
      },
    });

    expect(resolveGlwTargetMutationAvailability(target, "state_service")).toMatchObject({
    createAvailable: true,
    updateAvailable: false,
    plannedOperation: "CREATE_STATE",
  });
  });

  test("authoritatively protects an existing published state target", async () => {
    const stateRequest = {
      ...request(),
      pageType: "state_service" as const,
      stateCode: "CA",
      stateName: "California",
      citySlug: "",
      cityName: "",
      slug: "indoor-led-video-wall/california",
      title: "Indoor LED Video Wall in California",
      canonicalPath: "indoor-led-video-wall/california",
      plannedOperation: "CREATE_STATE" as const,
    };

    const authority = authorityFromBodies([
      [{ id: 124, slug: "indoor-led-video-wall", parent: 0, status: "publish" }],
      [{ id: 9001, slug: "california", parent: 124, status: "publish" }],
    ]);

    const target = await readGlwTargetPreflight({
      request: stateRequest,
      wordpressReadAuthority: authority,
      localExecutions: [],
    });

    expect(target).toMatchObject({
      state: "EXISTS_PUBLISHED",
      wordpressObjectId: "9001",
      wordpressStatus: "publish",
      canonicalSlug: "california",
      canonicalParentId: "124",
    });

    expect(resolveGlwTargetMutationAvailability(target, "state_service")).toMatchObject({
      createAvailable: false,
      updateAvailable: false,
      plannedOperation: null,
    });
  });
  test("keeps publication outside target-preflight mutation availability", () => {
    expect(resolveGlwTargetMutationAvailability(result("ABSENT")).plannedOperation).toBe("CREATE_CITY");
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_DRAFT")).plannedOperation).toBe("UPDATE_CITY");
  });
});