jest.mock("server-only", () => ({}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({
    username: "test-user",
    applicationPassword: "test-password",
  })),
}));

import { resolveOrCreateGenesisWordPressHierarchy } from "../wordpress-hierarchy-authority";
import type { SiteConfiguration } from "../types";

function createSite(): SiteConfiguration {
  return {
    siteId: "site-test",
    organizationId: "org-test",
    siteName: "Test Site",
    displayName: "Test Site",
    slug: "test-site",
    domain: "example.com",
    primaryAddress: null,
    canonicalUrl: "https://example.com",
    environment: "production",
    lifecycleState: "active",
    enabled: true,
    healthStatus: "healthy",
    publishingStatus: "enabled",
    defaultContentType: "page",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2",
      wordpressCredentialReference: "credref-wp-test",
      workflowReference: null,
    },
    profiles: {
      brandProfileId: null,
      seoProfileId: null,
      promptProfileId: null,
      imageProfileId: null,
      wordpressProfileId: null,
      publishingProfileId: null,
      workflowProfileId: null,
    },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    notes: null,
  };
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

describe("Genesis WordPress hierarchy authority", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("resolves an exact existing product and state hierarchy without mutation", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, [
        { id: 100, slug: "accent-rear-projection-film", parent: 0, status: "publish" },
      ]))
      .mockResolvedValueOnce(response(200, [
        { id: 200, slug: "texas", parent: 100, status: "draft" },
      ]));

    global.fetch = fetchMock as typeof fetch;

    const result = await resolveOrCreateGenesisWordPressHierarchy({
      site: createSite(),
      productSlug: "accent-rear-projection-film",
      productTitle: "Accent Rear Projection Film",
      stateSlug: "texas",
      stateTitle: "Texas",
    });

    expect(result).toMatchObject({
      ok: true,
      product: { state: "EXISTS_PUBLISHED", wordpressObjectId: 100 },
      state: { state: "EXISTS_DRAFT", wordpressObjectId: 200, parentId: 100 },
      leafParentId: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => call[1]?.method === "GET")).toBe(true);
  });

  test("creates missing product and state parents as drafts and re-verifies both", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(201, {
        id: 101, slug: "accent-rear-projection-film", parent: 0, status: "draft",
      }))
      .mockResolvedValueOnce(response(200, [
        { id: 101, slug: "accent-rear-projection-film", parent: 0, status: "draft" },
      ]))
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(201, {
        id: 201, slug: "texas", parent: 101, status: "draft",
      }))
      .mockResolvedValueOnce(response(200, [
        { id: 201, slug: "texas", parent: 101, status: "draft" },
      ]));

    global.fetch = fetchMock as typeof fetch;

    const result = await resolveOrCreateGenesisWordPressHierarchy({
      site: createSite(),
      productSlug: "accent-rear-projection-film",
      productTitle: "Accent Rear Projection Film",
      stateSlug: "texas",
      stateTitle: "Texas",
    });

    expect(result).toMatchObject({ ok: true, leafParentId: 201 });
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const productCreate = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    const stateCreate = JSON.parse(String(fetchMock.mock.calls[4][1].body));
    expect(productCreate).toMatchObject({
      slug: "accent-rear-projection-film", parent: 0, status: "draft",
    });
    expect(stateCreate).toMatchObject({
      slug: "texas", parent: 101, status: "draft",
    });
    expect(productCreate.status).not.toBe("publish");
    expect(stateCreate.status).not.toBe("publish");
  });

  test("fails closed when multiple exact product parents are returned", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response(200, [
      { id: 100, slug: "accent-rear-projection-film", parent: 0, status: "draft" },
      { id: 101, slug: "accent-rear-projection-film", parent: 0, status: "draft" },
    ]));
    global.fetch = fetchMock as typeof fetch;

    const result = await resolveOrCreateGenesisWordPressHierarchy({
      site: createSite(),
      productSlug: "accent-rear-projection-film",
      productTitle: "Accent Rear Projection Film",
      stateSlug: "texas",
      stateTitle: "Texas",
    });

    expect(result).toMatchObject({ ok: false, state: "collision" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("fails closed on unsupported existing hierarchy status", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response(200, [
      { id: 100, slug: "accent-rear-projection-film", parent: 0, status: "pending" },
    ]));
    global.fetch = fetchMock as typeof fetch;

    const result = await resolveOrCreateGenesisWordPressHierarchy({
      site: createSite(),
      productSlug: "accent-rear-projection-film",
      productTitle: "Accent Rear Projection Film",
      stateSlug: "texas",
      stateTitle: "Texas",
    });

    expect(result).toMatchObject({ ok: false, state: "collision" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not adopt a same-slug state beneath the wrong product parent", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, [
        { id: 100, slug: "accent-rear-projection-film", parent: 0, status: "publish" },
      ]))
      .mockResolvedValueOnce(response(200, [
        { id: 999, slug: "texas", parent: 777, status: "draft" },
      ]))
      .mockResolvedValueOnce(response(201, {
        id: 201, slug: "texas", parent: 100, status: "draft",
      }))
      .mockResolvedValueOnce(response(200, [
        { id: 201, slug: "texas", parent: 100, status: "draft" },
      ]));
    global.fetch = fetchMock as typeof fetch;

    const result = await resolveOrCreateGenesisWordPressHierarchy({
      site: createSite(),
      productSlug: "accent-rear-projection-film",
      productTitle: "Accent Rear Projection Film",
      stateSlug: "texas",
      stateTitle: "Texas",
    });

    expect(result).toMatchObject({ ok: true, leafParentId: 201 });
    const stateCreate = JSON.parse(String(fetchMock.mock.calls[2][1].body));
    expect(stateCreate.parent).toBe(100);
    expect(stateCreate.status).toBe("draft");
  });
});
