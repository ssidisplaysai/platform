import {
  inferWordPressEndpoints,
  runPublicWordPressPreflight,
} from "../wordpress-public-preflight";

function response(input: { ok?: boolean; status?: number; url: string; headers?: Record<string, string> }) {
  return {
    ok: input.ok ?? true,
    status: input.status ?? 200,
    url: input.url,
    headers: {
      get(name: string) {
        return input.headers?.[name.toLowerCase()] ?? null;
      },
    },
    async json() {
      return {};
    },
  };
}

describe("fresh WordPress public preflight", () => {
  test("infers canonical admin and REST endpoints", () => {
    expect(inferWordPressEndpoints({ domain: "Example-Fresh-Site.test" })).toEqual({
      domain: "example-fresh-site.test",
      canonicalUrl: "https://example-fresh-site.test",
      adminUrl: "https://example-fresh-site.test/wp-admin",
      apiBaseUrl: "https://example-fresh-site.test/wp-json/wp/v2",
    });
  });

  test.each([
    "http://example.com",
    "https://user:secret@example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://example.com:8443",
    "https://example.com/path",
  ])("rejects unsafe domain input %s", (domain) => {
    expect(() => inferWordPressEndpoints({ domain })).toThrow();
  });

  test("rejects hosts resolving to private addresses before fetch", async () => {
    const fetcher = jest.fn();
    await expect(runPublicWordPressPreflight(
      { domain: "internal.example", intent: "fresh" },
      {
        resolveHost: async () => [{ address: "10.0.0.4", family: 4 }],
        fetcher,
      },
    )).rejects.toThrow("public IP addresses");
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("accepts a synthetic empty fresh WordPress site as low complexity", async () => {
    const fetcher = jest.fn(async (url: string) => response({
      url,
      headers: url.endsWith("wp-json/wp/v2")
        ? {}
        : { link: "<https://example-fresh-site.test/wp-json/>; rel=\"https://api.w.org/\"" },
    }));

    const result = await runPublicWordPressPreflight(
      { domain: "example-fresh-site.test", intent: "fresh" },
      {
        resolveHost: async () => [{ address: "203.0.113.25", family: 4 }],
        fetcher,
      },
    );

    expect(result).toMatchObject({
      ready: true,
      domain: "example-fresh-site.test",
      integration: { complexity: "LOW", effort: "LOW" },
      checks: {
        https: true,
        publicHost: true,
        reachable: true,
        wordpressDetected: true,
        adminReachable: true,
        restAvailable: true,
        canonicalConsistent: true,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test("fails canonical redirects to another domain", async () => {
    const result = await runPublicWordPressPreflight(
      { domain: "example-fresh-site.test", intent: "fresh" },
      {
        resolveHost: async () => [{ address: "203.0.113.25", family: 4 }],
        fetcher: async (url) => response({
          url: url.includes("wp-admin") ? "https://other.test/wp-admin" : url,
        }),
      },
    );

    expect(result.ready).toBe(false);
    expect(result.checks.canonicalConsistent).toBe(false);
    expect(result.blockers).toContain("canonical consistent");
  });

  test("does not follow a redirect to another host", async () => {
    const fetcher = jest.fn(async (url: string) => url.endsWith("/wp-admin")
      ? response({ ok: false, status: 302, url, headers: { location: "https://127.0.0.1/wp-admin" } })
      : response({ url }));

    const result = await runPublicWordPressPreflight(
      { domain: "example-fresh-site.test", intent: "fresh" },
      {
        resolveHost: async () => [{ address: "203.0.113.25", family: 4 }],
        fetcher,
      },
    );

    expect(result.ready).toBe(false);
    expect(fetcher.mock.calls.flat().join(" ")).not.toContain("127.0.0.1");
  });
});