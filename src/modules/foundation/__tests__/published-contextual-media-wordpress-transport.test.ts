jest.mock("server-only", () => ({}));
jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: () => ({ username: "user", applicationPassword: "password" }),
}));
import { createPublishedContextualMediaWordPressTransport } from "../published-contextual-media-wordpress-transport";
import type { SiteConfiguration } from "../types";

const site = {
  siteId: "site-ssi-projectorenclosure",
  domain: "projectorenclosure.com",
  integrations: {
    wordpressApiBaseUrl: "https://projectorenclosure.com/wp-json/wp/v2",
    wordpressCredentialReference: "credential-ref",
  },
} as SiteConfiguration;

describe("published contextual-media WordPress transport", () => {
  test("resolves a post after a page miss and writes through the post collection", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url.includes("/pages/11828?")) return new Response("{}", { status: 404 });
      if (url.includes("/posts/11828?")) return Response.json({ id: 11828, slug: "fan-cooled-projector-enclosure-holiday-projection-mapping", status: "publish", featured_media: 0, parent: 0, title: { raw: "Projector Enclosure for Holiday Projection Mapping" }, content: { raw: "<h1>Holiday mapping</h1>" }, yoast_head_json: { canonical: "https://projectorenclosure.com/fan-cooled-projector-enclosure-holiday-projection-mapping/", robots: { index: "index", follow: "follow" } } });
      if (url.includes("/pages?slug=")) return Response.json([]);
      if (url.includes("/posts?slug=")) return Response.json([{ id: 11828, slug: "fan-cooled-projector-enclosure-holiday-projection-mapping", status: "publish" }]);
      if (url.includes("/ssi/v1/redirect")) return Response.json({ exists: false });
      if (url.endsWith("/posts/11828") && method === "POST") return Response.json({ id: 11828 });
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const transport = createPublishedContextualMediaWordPressTransport(site);
    const page = await transport?.readPage(11828);
    expect(page).toMatchObject({ id: 11828, status: "publish", featuredMediaId: 0 });
    expect(await transport?.verifyTargetAuthority(page!)).toBe(true);
    expect(await transport?.writePublishedPageContent(11828, { content: "updated", featuredMediaId: 0 })).toBe(true);
    expect(requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.stringContaining("/pages/11828?"), method: "GET" }),
      expect.objectContaining({ url: expect.stringContaining("/posts/11828?"), method: "GET" }),
      expect.objectContaining({ url: "https://projectorenclosure.com/wp-json/wp/v2/posts/11828", method: "POST" }),
    ]));
  });
});