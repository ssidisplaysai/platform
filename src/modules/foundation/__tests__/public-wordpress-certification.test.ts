jest.mock("server-only", () => ({}));

import { certifyPublicWordPressSite } from "@/modules/foundation/public-wordpress-certification";

function response(body: string, status: number, url: string): Response {
  const value = new Response(body, { status });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

const html = (input: { title: string; h1: string; canonical: string; links?: string[]; image?: string }) => `<!doctype html>
<html><head><title>${input.title}</title><link rel="canonical" href="${input.canonical}"><meta name="description" content="Useful public description"><meta name="robots" content="index,follow"></head>
<body><header>Example Fabrication</header><h1>${input.h1}</h1>${(input.links ?? []).map((link) => `<a href="${link}">Route</a>`).join("")}${input.image ? `<img src="${input.image}" alt="Approved product">` : ""}</body></html>`;

describe("public WordPress certification", () => {
  test("certifies canonical public routes, redirects, media, links, and viewport evidence", async () => {
    const origin = "https://example.test";
    const bodies = new Map([
      [`${origin}/`, html({ title: "Home", h1: "Example Fabrication", canonical: `${origin}/`, links: ["/services/"], image: "/media/product.jpg" })],
      [`${origin}/services/`, html({ title: "Services", h1: "Services", canonical: `${origin}/services/`, links: ["/"] })],
    ]);
    const fetcher = jest.fn(async (url: string, init?: RequestInit) => {
      if (url === `${origin}/old-services/`) return response("", 200, `${origin}/services/`);
      if (init?.method === "HEAD" && url === `${origin}/media/product.jpg`) return response("", 200, url);
      return response(bodies.get(url) ?? "missing", bodies.has(url) ? 200 : 404, url);
    });

    const result = await certifyPublicWordPressSite({
      spec: {
        canonicalOrigin: origin,
        wordpressSettings: { home: origin, siteUrl: origin },
        expectedBrand: "Example Fabrication",
        routes: [
          { path: "/", expectedH1: "Example Fabrication", expectedTitle: "Home" },
          { path: "/services/", expectedH1: "Services", expectedTitle: "Services" },
        ],
        oldRedirects: [{ from: "/old-services/", to: "/services/" }],
        viewportEvidence: [
          { viewport: "desktop", navigationVisible: true, navigationOperable: true, brandIdentityVisible: true, horizontalOverflow: false },
          { viewport: "mobile", navigationVisible: true, navigationOperable: true, brandIdentityVisible: true, horizontalOverflow: false },
        ],
      },
      fetcher,
    });

    expect(result).toMatchObject({ ready: true, orphanPaths: [], mutationPerformed: false });
    expect(result.redirects).toEqual([expect.objectContaining({ valid: true })]);
  });

  test("fails closed on rendered public defects", async () => {
    const origin = "https://example.test";
    const fetcher = jest.fn(async (url: string, init?: RequestInit) => init?.method === "HEAD"
      ? response("", 404, url)
      : response(`<!doctype html><html><head><title>Wrong</title><link rel="canonical" href="http://example.test/wrong/"><meta name="robots" content="noindex"></head><body>Hello world Genesis <h1>One</h1><h1>Two</h1><a href="#">Broken</a><a href="http://localhost:3000/debug">Debug</a><img src="/missing.jpg"></body></html>`, 200, url));

    const result = await certifyPublicWordPressSite({
      spec: { canonicalOrigin: origin, wordpressSettings: { home: "http://example.test", siteUrl: "https://staging.example.test" }, expectedBrand: "Example Fabrication", routes: [{ path: "/", expectedH1: "Expected", expectedTitle: "Expected" }] },
      fetcher,
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      "/:CANONICAL_URL_MISMATCH",
      "/:H1_COUNT_INVALID",
      "/:TITLE_MISMATCH",
      "/:META_DESCRIPTION_MISSING",
      "/:INDEXABILITY_BLOCKED",
      "/:PLACEHOLDER_LINKS_PRESENT",
      "/:DEVELOPMENT_URL_LEAK",
      "/:GOVERNANCE_COPY_LEAK",
      "/:DEFAULT_WORDPRESS_ARTIFACT",
      "/:BROKEN_MEDIA",
      "/:PUBLIC_BRAND_IDENTITY_MISSING",
      "WORDPRESS_HOME_MISMATCH",
      "WORDPRESS_SITEURL_MISMATCH",
    ]));
  });
});
