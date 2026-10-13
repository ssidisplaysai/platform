jest.mock("server-only", () => ({}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({
    username: "test-user",
    applicationPassword: "test-password",
  })),
}));

import { writeGenesisWordPressDraft } from "../wordpress-draft-writer";
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
    json: async () => body,
  } as Response;
}

describe("Genesis WordPress draft writer hierarchy safety", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("creates a city draft beneath the exact authorized state parent", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(201, {
        id: 501,
        slug: "austin",
        parent: 200,
        status: "draft",
        link: "https://example.com/product/texas/austin/",
      }));
    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Example in Austin",
        contentHtml: "<p>Generated content</p>",
        slug: "product/texas/austin",
        parentId: 200,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "CREATE",
      wordpressObjectId: "501",
      wordpressStatus: "draft",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("parent=200");
    const body = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(body).toMatchObject({ slug: "austin", parent: 200, status: "draft" });
  });

  test("blocks update when the persisted draft is beneath a different parent", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(200, {
        id: 812,
        slug: "austin",
        parent: 999,
        status: "draft",
        link: "https://example.com/wrong/austin/",
      }));
    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: createSite(),
      wordpressObjectId: "812",
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
        parentId: 200,
      },
    });

    expect(result).toMatchObject({ ok: false, state: "identity_mismatch" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("blocks create when the exact slug already exists beneath the authorized parent", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response(200, [
      { id: 700, slug: "austin", parent: 200, status: "draft" },
    ]));
    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
        parentId: 200,
      },
    });

    expect(result).toMatchObject({ ok: false, state: "collision" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not treat same slug beneath another parent as the authorized target", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, [
        { id: 700, slug: "austin", parent: 999, status: "draft" },
      ]))
      .mockResolvedValueOnce(response(201, {
        id: 701,
        slug: "austin",
        parent: 200,
        status: "draft",
        link: "https://example.com/product/texas/austin/",
      }));
    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
        parentId: 200,
      },
    });

    expect(result).toMatchObject({ ok: true, wordpressObjectId: "701" });
    const body = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(body.parent).toBe(200);
  });

  test("fails if WordPress returns the created draft beneath a different parent", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(201, {
        id: 501,
        slug: "austin",
        parent: 999,
        status: "draft",
        link: "https://example.com/austin/",
      }));
    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
        parentId: 200,
      },
    });

    expect(result).toMatchObject({ ok: false, state: "write_failed" });
  });
});
