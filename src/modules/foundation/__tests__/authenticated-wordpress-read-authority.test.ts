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

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

describe("authenticated WordPress read authority", () => {
  test("normalizes the REST root and requires HTTPS", () => {
    expect(normalizeWordPressApiBaseUrl("https://example.test/")).toBe("https://example.test/wp-json/wp/v2");
    expect(() => normalizeWordPressApiBaseUrl("http://example.test/")).toThrow("HTTPS");
  });

  test("performs authenticated GET-only no-store reads", async () => {
    const fetcher = jest.fn(async () => response(200, [{ id: 1, status: "draft" }]));
    const authority = createAuthenticatedWordPressReadAuthority({ configuration, fetcher });
    await expect(authority.getJson({
      path: "/pages",
      query: new URLSearchParams({ context: "edit", status: "any" }),
    })).resolves.toEqual({ ok: true, body: [{ id: 1, status: "draft" }] });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain("context=edit");
    expect(url).toContain("status=any");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.headers.Authorization).toMatch(/^Basic /);
    expect(Object.keys(authority)).toEqual(["getJson"]);
  });

  test.each([401, 403])("fails closed on authentication failure %i without emitting secrets", async (status) => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => response(status, { password: configuration.applicationPassword }),
    });
    const result = await authority.getJson({ path: "/pages" });
    expect(result).toEqual({ ok: false, reason: "AUTH_FAILURE" });
    expect(JSON.stringify(result)).not.toContain(configuration.username);
    expect(JSON.stringify(result)).not.toContain(configuration.applicationPassword);
  });

  test("distinguishes authenticated not-found from an unverifiable read", async () => {
    const authority = createAuthenticatedWordPressReadAuthority({
      configuration,
      fetcher: async () => response(404, { code: "rest_post_invalid_id" }),
    });
    await expect(authority.getJson({ path: "/pages/123" })).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  test("rejects endpoint escape without making a request", async () => {
    const fetcher = jest.fn(async () => response(200, []));
    const authority = createAuthenticatedWordPressReadAuthority({ configuration, fetcher });
    await expect(authority.getJson({ path: "../users" })).resolves.toEqual({ ok: false, reason: "NETWORK_ERROR" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});