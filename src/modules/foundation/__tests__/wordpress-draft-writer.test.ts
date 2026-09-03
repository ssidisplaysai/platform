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

function response(
  status: number,
  body: unknown,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("Genesis WordPress draft writer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("creates only a WordPress draft after authoritative absence", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(
        response(201, {
          id: 501,
          slug: "austin",
          status: "draft",
          link: "https://example.com/austin/",
        }),
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Example in Austin",
        contentHtml: "<p>Generated content</p>",
        slug: "product/texas/austin",
        excerpt: "Example excerpt",
      },
    });

    expect(result).toEqual({
      ok: true,
      operation: "CREATE",
      wordpressObjectId: "501",
      wordpressUrl: "https://example.com/austin/",
      wordpressStatus: "draft",
      seoMetadataAttempted: false,
      seoMetadataAccepted: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const writeInit = fetchMock.mock.calls[1][1];
    const body = JSON.parse(
      String(writeInit.body),
    ) as Record<string, unknown>;

    expect(writeInit.method).toBe("POST");
    expect(body.status).toBe("draft");
    expect(body.slug).toBe("austin");
    expect(body.title).toBe("Example in Austin");
    expect(body.content).toBe(
      "<p>Generated content</p>",
    );
    expect(body.status).not.toBe("publish");
  });

  test("blocks create when the exact slug already exists", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      response(200, [
        {
          id: 700,
          slug: "austin",
          status: "draft",
          link: "https://example.com/austin/",
        },
      ]),
    );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Example in Austin",
        contentHtml: "<p>Generated content</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      state: "collision",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("blocks create when the exact slug is already published", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      response(200, [
        {
          id: 701,
          slug: "austin",
          status: "publish",
          link: "https://example.com/austin/",
        },
      ]),
    );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "CREATE",
      site: createSite(),
      artifact: {
        title: "Example in Austin",
        contentHtml: "<p>Generated content</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      state: "published_target",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("updates only the exact existing draft object", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, [
          {
            id: 812,
            slug: "austin",
            status: "draft",
            link: "https://example.com/austin/",
          },
        ]),
      )
      .mockResolvedValueOnce(
        response(200, {
          id: 812,
          slug: "austin",
          status: "draft",
          link: "https://example.com/austin/",
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          id: 812,
          slug: "austin",
          status: "draft",
          link: "https://example.com/austin/",
        }),
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: createSite(),
      wordpressObjectId: "812",
      artifact: {
        title: "Updated Example",
        contentHtml: "<p>Updated content</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "UPDATE",
      wordpressObjectId: "812",
      wordpressStatus: "draft",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(
      String(fetchMock.mock.calls[2][0]),
    ).toBe(
      "https://example.com/wp-json/wp/v2/pages/812",
    );

    const body = JSON.parse(
      String(fetchMock.mock.calls[2][1].body),
    ) as Record<string, unknown>;

    expect(body.status).toBe("draft");
    expect(body.status).not.toBe("publish");
  });

  test("blocks update of a published WordPress object", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, [
          {
            id: 900,
            slug: "austin",
            status: "publish",
            link: "https://example.com/austin/",
          },
        ]),
      )
      .mockResolvedValueOnce(
        response(200, {
          id: 900,
          slug: "austin",
          status: "publish",
          link: "https://example.com/austin/",
        }),
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: createSite(),
      wordpressObjectId: "900",
      artifact: {
        title: "Unsafe Update",
        contentHtml: "<p>Unsafe</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      state: "published_target",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("blocks update when exact object ID has the wrong slug", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, []),
      )
      .mockResolvedValueOnce(
        response(200, {
          id: 950,
          slug: "dallas",
          status: "draft",
          link: "https://example.com/dallas/",
        }),
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: createSite(),
      wordpressObjectId: "950",
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      state: "identity_mismatch",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("rejects a non-numeric update identity before mutation", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, []),
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await writeGenesisWordPressDraft({
      operation: "UPDATE",
      site: createSite(),
      wordpressObjectId: "not-an-id",
      artifact: {
        title: "Austin",
        contentHtml: "<p>Austin</p>",
        slug: "product/texas/austin",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      state: "invalid_target",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});