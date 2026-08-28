import {
  createGlwCanonicalTargetIdentity,
  resolveGlwTargetMutationAvailability,
  resolveGlwTargetPreflight,
  readGlwTargetPreflight,
  type GlwTargetPreflightResult,
} from "../target-preflight";

const identity = createGlwCanonicalTargetIdentity({
  productId: "prod-indoor-led-video-wall",
  stateCode: "TX",
  citySlug: "dallas",
  applicationPath: "indoor-led-video-wall/texas/dallas",
  canonicalParentId: "2563",
});

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

describe("GLW canonical target preflight", () => {
  test("maps the Dallas application path to the canonical WordPress identity", () => {
    expect(identity).toMatchObject({
      applicationPath: "indoor-led-video-wall/texas/dallas",
      canonicalPath: "direct-view-led-video-walls/texas/dallas",
      canonicalProductSlug: "direct-view-led-video-walls",
      canonicalSlug: "dallas",
      canonicalParentId: "2563",
    });
  });

  test("represents known published Dallas as an existing page", () => {
    expect(resolveGlwTargetPreflight({
      identity,
      wordpressPages: [{ id: 18846, status: "publish", slug: "dallas", parent: 2563, title: { rendered: "Direct View LED Video Walls in Dallas, Texas" } }],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Dallas",
    })).toMatchObject({ state: "EXISTS_PUBLISHED", wordpressObjectId: "18846" });
  });

  test("blocks create for a published target", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_PUBLISHED")).createAvailable).toBe(false);
  });

  test("does not expose draft update for a published target", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_PUBLISHED")).updateAvailable).toBe(false);
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

  test("does not represent unknown target state as absent", () => {
    const unknown = result("UNKNOWN");
    expect(unknown.state).toBe("UNKNOWN");
    expect(resolveGlwTargetMutationAvailability(unknown).message).toContain("verified authoritatively");
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

  test("resolves the public Dallas hierarchy and existing page read-only", async () => {
    const responses = [
      [{ id: 124, slug: "direct-view-led-video-walls", parent: 0, status: "publish" }],
      [{ id: 2563, slug: "texas", parent: 124, status: "publish" }],
      [{ id: 18846, slug: "dallas", parent: 2563, status: "publish", title: { rendered: "Direct View LED Video Walls in Dallas, Texas" } }],
    ];
    const fetcher = jest.fn().mockImplementation(async () => ({ ok: true, async json() { return responses.shift(); } }));
    const target = await readGlwTargetPreflight({
      request: {
        siteId: "site-led-display-warehouse-production", productId: "prod-indoor-led-video-wall",
        pageType: "city_service", stateCode: "TX", citySlug: "dallas",
        slug: identity.applicationPath, title: "Dallas", seoTitle: "Dallas SEO", metaDescription: "Dallas meta",
        publicationIntent: "draft", organizationId: "org", siteName: "LEDDisplayWarehouse.com",
        productTopic: "Indoor LED Video Wall", stateName: "Texas", cityName: "Dallas",
        canonicalPath: identity.applicationPath, plannedOperation: "CREATE_CITY", wordpressObjectId: null,
        externalExecutionAllowed: false,
      },
      wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2",
      localExecutions: [],
      fetcher,
    });
    expect(target).toMatchObject({
      state: "EXISTS_PUBLISHED", wordpressObjectId: "18846",
      canonicalPath: "direct-view-led-video-walls/texas/dallas", canonicalParentId: "2563",
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][0]).toContain("slug=dallas");
    expect(fetcher.mock.calls[2][0]).toContain("parent=2563");
  });

  test("keeps a public zero-result lookup unknown because drafts are not visible", async () => {
    const responses = [[{ id: 124 }], [{ id: 2563 }], []];
    const target = await readGlwTargetPreflight({
      request: {
        siteId: "site-led-display-warehouse-production", productId: "prod-indoor-led-video-wall",
        pageType: "city_service", stateCode: "TX", citySlug: "houston",
        slug: "indoor-led-video-wall/texas/houston", title: "Houston", seoTitle: "Houston SEO", metaDescription: "Houston meta",
        publicationIntent: "draft", organizationId: "org", siteName: "LEDDisplayWarehouse.com",
        productTopic: "Indoor LED Video Wall", stateName: "Texas", cityName: "Houston",
        canonicalPath: "indoor-led-video-wall/texas/houston", plannedOperation: "CREATE_CITY", wordpressObjectId: null,
        externalExecutionAllowed: false,
      },
      wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2",
      localExecutions: [],
      fetcher: async () => ({ ok: true, async json() { return responses.shift(); } }),
    });
    expect(target.state).toBe("UNKNOWN");
    expect(resolveGlwTargetMutationAvailability(target).message).toContain("verified authoritatively");
  });

  test("blocks all mutation choices for a known published page", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_PUBLISHED"))).toMatchObject({
      createAvailable: false,
      updateAvailable: false,
      plannedOperation: null,
    });
  });

  test("never falls back from exact update to create", () => {
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_DRAFT"))).toMatchObject({
      createAvailable: false,
      updateAvailable: true,
      wordpressObjectId: "3001",
    });
  });

  test("ignores a local execution for another canonical application path", () => {
    const target = resolveGlwTargetPreflight({
      identity,
      localExecutions: [{
        jobId: "other", correlationId: "other", executionTransport: "N8N_MCP", organizationId: "org",
        siteId: "site-led-display-warehouse-production", productId: "prod-indoor-led-video-wall",
        productTopic: "Indoor LED Video Wall", state: "Texas", city: "Dallas", slug: "another/path",
        title: "Other", seoTitle: "Other", metaDescription: "Other", publicationIntent: "draft",
        status: "COMPLETE", externalExecutionId: "2", wordpressObjectId: "9999", wordpressUrl: null,
        wordpressStatus: "draft", errorCode: null, errorMessage: null, requestedPublicationMode: "draft",
        disposition: "CREATED", qaStatus: "COMPLETE", qaChecks: {}, qaFailureReasons: {},
        focusKeyphrase: null, wordCount: null, featuredImagePresent: null,
        createdAt: "2026-01-01", dispatchedAt: "2026-01-01", updatedAt: "2026-01-01", completedAt: "2026-01-01",
      }],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Dallas",
    });
    expect(target.state).toBe("UNKNOWN");
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

  test("keeps publication outside target-preflight mutation availability", () => {
    expect(resolveGlwTargetMutationAvailability(result("ABSENT")).plannedOperation).toBe("CREATE_CITY");
    expect(resolveGlwTargetMutationAvailability(result("EXISTS_DRAFT")).plannedOperation).toBe("UPDATE_CITY");
  });
});