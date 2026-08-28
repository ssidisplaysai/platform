import {
  createAuthenticatedWordPressReadAuthority,
  normalizeWordPressApiBaseUrl,
} from "../authenticated-wordpress-read-authority";

const configuration = {
  apiBaseUrl: "https://example.test/",
  username: "read-user",
  applicationPassword: "sensitive-application-password",
  timeoutMs: 1_000,
};

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find(
          (candidate) => candidate.toLowerCase() === name.toLowerCase(),
        );
        return key ? headers[key] : null;
      },
    },
    async json() {
      return body;
    },
  };
}

describe("Genesis authenticated WordPress read authority", () => {
  test("normalizes site root to WordPress REST v2 root", () => {
    expect(
      normalizeWordPressApiBaseUrl("https://example.test/"),
    ).toBe("https://example.test/wp-json/wp/v2");
  });

  test("preserves existing WordPress REST v2 root", () => {
    expect(
      normalizeWordPressApiBaseUrl(
        "https://example.test/wp-json/wp/v2",
      ),
    ).toBe("https://example.test/wp-json/wp/v2");
  });

  test("rejects non-HTTPS remote authority", () => {
    expect(() =>
      normalizeWordPressApiBaseUrl("http://example.test"),
    ).toThrow("WordPress read authority must use HTTPS outside localhost.");
  });

  test("performs authenticated GET only", async () => {
    const fetcher = jest.fn(async () => response(200, [{ id: 1 }]));

    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher,
    });

    const result = await authority.getJson({
      path: "/pages",
      query: new URLSearchParams({
        context: "edit",
        status: "any",
      }),
    });

    expect(result).toEqual({
      ok: true,
      body: [{ id: 1 }],
      pagination: {
        total: null,
        totalPages: null,
      },
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, init] = fetcher.mock.calls[0];

    expect(init.method).toBe("GET");
    expect(url).toContain("/wp-json/wp/v2/pages?");
    expect(url).toContain("context=edit");
    expect(url).toContain("status=any");
    expect(init.headers.Authorization).toMatch(/^Basic /);
  });

  test("returns bounded WordPress pagination metadata", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () =>
        response(
          200,
          [{ id: 1 }],
          {
            "X-WP-Total": "245",
            "X-WP-TotalPages": "3",
            "X-Unrelated-Secret": "must-not-be-returned",
          },
        ),
    });

    const result = await authority.getJson({
      path: "/pages",
    });

    expect(result).toEqual({
      ok: true,
      body: [{ id: 1 }],
      pagination: {
        total: 245,
        totalPages: 3,
      },
    });

    expect(JSON.stringify(result)).not.toContain("must-not-be-returned");
  });

  test("rejects malformed pagination metadata without failing the body read", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () =>
        response(
          200,
          [],
          {
            "X-WP-Total": "not-a-number",
            "X-WP-TotalPages": "-1",
          },
        ),
    });

    const result = await authority.getJson({
      path: "/pages",
    });

    expect(result).toEqual({
      ok: true,
      body: [],
      pagination: {
        total: null,
        totalPages: null,
      },
    });
  });
  test.each([401, 403])("classifies auth failure %i", async (status) => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => response(status, { code: "forbidden" }),
    });

    await expect(
      authority.getJson({ path: "/pages" }),
    ).resolves.toEqual({
      ok: false,
      reason: "AUTH_FAILURE",
    });
  });

  test("classifies malformed JSON response", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => ({
        ok: true,
        status: 200,
        async json() {
          throw new Error("invalid json");
        },
      }),
    });

    await expect(
      authority.getJson({ path: "/pages" }),
    ).resolves.toEqual({
      ok: false,
      reason: "MALFORMED_RESPONSE",
    });
  });

  test("classifies timeout", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    });

    await expect(
      authority.getJson({ path: "/pages" }),
    ).resolves.toEqual({
      ok: false,
      reason: "READ_TIMEOUT",
    });
  });

  test("classifies network failure without leaking secrets", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => {
        throw new Error("password=sensitive-application-password");
      },
    });

    const result = await authority.getJson({
      path: "/pages",
    });

    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: false,
      reason: "NETWORK_ERROR",
    });

    expect(serialized).not.toContain(configuration.username);
    expect(serialized).not.toContain(configuration.applicationPassword);
    expect(serialized).not.toContain("Basic ");
  });

  test.each([
    "../users",
    "/../users",
    "/pages?status=publish",
    "/pages#fragment",
    "https://evil.example/pages",
  ])("rejects endpoint escape or embedded URL syntax: %s", async (path) => {
    const fetcher = jest.fn(async () => response(200, []));

    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher,
    });

    await expect(
      authority.getJson({ path }),
    ).resolves.toEqual({
      ok: false,
      reason: "NETWORK_ERROR",
    });

    expect(fetcher).not.toHaveBeenCalled();
  });
  test("authority exposes no mutation surface", () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => response(200, []),
    }) as unknown as Record<string, unknown>;

    expect(Object.keys(authority)).toEqual(["getJson"]);
    expect(authority.post).toBeUndefined();
    expect(authority.put).toBeUndefined();
    expect(authority.patch).toBeUndefined();
    expect(authority.delete).toBeUndefined();
    expect(authority.createPage).toBeUndefined();
    expect(authority.updatePage).toBeUndefined();
    expect(authority.uploadMedia).toBeUndefined();
  });
});
