jest.mock("server-only", () => ({}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({ username: "publisher", applicationPassword: "password" })),
}));

import { attachGenesisWordPressExistingFeaturedImage } from "../wordpress-media-writer";
import type { SiteConfiguration } from "../types";

const site = {
  integrations: {
    wordpressApiBaseUrl: "https://destination.example/wp-json/wp/v2",
    wordpressCredentialReference: "credref",
  },
} as SiteConfiguration;

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

test("attaches exact existing Product Intelligence media without upload", async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(response({ id: 99, status: "draft", featured_media: 0, content: { raw: "<h1>Page</h1><p>Body</p>" } }))
    .mockResolvedValueOnce(response({ id: 77, media_type: "image", source_url: "https://destination.example/product.jpg", alt_text: "Exact product" }))
    .mockResolvedValueOnce(response({ id: 99, status: "draft", featured_media: 77 }));
  global.fetch = fetchMock as typeof fetch;

  await expect(attachGenesisWordPressExistingFeaturedImage({
    site,
    wordpressObjectId: "99",
    contentHtml: "<h1>Page</h1><p>Body</p>",
    wordpressMediaId: 77,
    expectedMediaUrl: "https://destination.example/product.jpg",
    altText: "Exact product",
  })).resolves.toMatchObject({ ok: true, mediaId: "77", provenance: "PRODUCT_INTELLIGENCE" });

  expect(fetchMock).toHaveBeenCalledTimes(3);
  const [attachUrl, attachInit] = fetchMock.mock.calls[2];
  expect(attachUrl).toBe("https://destination.example/wp-json/wp/v2/pages/99");
  const attachBody = JSON.parse(String(attachInit.body));
  expect(attachBody.featured_media).toBe(77);
  expect(attachBody.status).toBe("draft");
  expect(attachBody.content).toContain('<h1>Page</h1>');
  expect(attachBody.content).toContain('class="page-hero-image"');
  expect(attachBody.content).toContain('src="https://destination.example/product.jpg"');
  expect(attachBody.content.match(/page-hero-image/g)).toHaveLength(1);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/media"))).toBe(false);
});

test.each([
  {
    name: "published page",
    page: { id: 99, status: "publish" },
    media: { id: 77, media_type: "image", source_url: "https://destination.example/product.jpg" },
    expectedState: "published_target",
  },
  {
    name: "mismatched media identity",
    page: { id: 99, status: "draft" },
    media: { id: 78, media_type: "image", source_url: "https://destination.example/product.jpg" },
    expectedState: "invalid_target",
  },
  {
    name: "cross-site media URL",
    page: { id: 99, status: "draft" },
    media: { id: 77, media_type: "image", source_url: "https://foreign.example/product.jpg" },
    expectedState: "invalid_target",
    expectedMediaUrl: "https://foreign.example/product.jpg",
  },
])("rejects $name before mutation", async ({ page, media, expectedState, expectedMediaUrl = "https://destination.example/product.jpg" }) => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(response(page))
    .mockResolvedValueOnce(response(media));
  global.fetch = fetchMock as typeof fetch;

  await expect(attachGenesisWordPressExistingFeaturedImage({
    site,
    wordpressObjectId: "99",
    contentHtml: "<h1>Page</h1><p>Body</p>",
    wordpressMediaId: 77,
    expectedMediaUrl,
    altText: "Exact product",
  })).resolves.toMatchObject({ ok: false, state: expectedState });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});