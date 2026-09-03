jest.mock("server-only", () => ({}));

const getJson = jest.fn();
jest.mock("../authenticated-wordpress-read-authority", () => ({
  createAuthenticatedWordPressReadAuthority: jest.fn(() => ({ getJson })),
}));

const resolveWordPressCredentialReference = jest.fn(() => null as { username: string; applicationPassword: string } | null);
jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference,
}));

import {
  renderSiteStudioAuthorityLinks,
  resolveSiteStudioProductAuthority,
  type SiteStudioProductAuthority,
} from "../site-studio-product-authority";
import type { ProductConfiguration, SiteConfiguration } from "../types";

const site = {
  siteId: "site-destination",
  domain: "destination.example",
  canonicalUrl: "https://destination.example",
  integrations: {
    wordpressApiBaseUrl: "https://destination.example/wp-json/wp/v2",
    wordpressCredentialReference: "env:WORDPRESS_TEST",
  },
} as SiteConfiguration;

function product(source: string): ProductConfiguration {
  return {
    productId: "product-1",
    organizationId: "org-1",
    productName: "Exact Product",
    productFamily: "Product Family",
    categoryIds: ["category-1"],
    sourceEvidenceReference: `wordpress-page:42:${source}`,
    media: { primaryImageReference: null, galleryImageReferences: [], videoReferences: [] },
    documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
    specifications: [],
  } as unknown as ProductConfiguration;
}

describe("Site Studio Product Intelligence authority", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    getJson.mockReset();
    resolveWordPressCredentialReference.mockReturnValue(null);
  });

  test("uses only a valid destination-site canonical product URL", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, url: "https://destination.example/exact-product/" })) as typeof fetch;
    const authority = await resolveSiteStudioProductAuthority({ site, product: product("https://destination.example/exact-product/"), products: [] });
    expect(authority.canonicalProduct).toMatchObject({
      url: "https://destination.example/exact-product/",
      source: "PRODUCT_INTELLIGENCE",
      destinationValid: true,
      external: false,
    });
  });

  test("does not leak an owning-site URL into another destination site", async () => {
    const authority = await resolveSiteStudioProductAuthority({ site, product: product("https://owner.example/exact-product/"), products: [] });
    expect(authority.canonicalProduct).toBeNull();
    expect(authority.selectedInternalLinks).toEqual([]);
  });

  test("classifies authenticated source-page links without selecting external references", async () => {
    resolveWordPressCredentialReference.mockReturnValue({ username: "reader", applicationPassword: "secret" });
    getJson.mockResolvedValue({
      ok: true,
      body: {
        id: 42,
        status: "publish",
        link: "https://destination.example/exact-product/",
        content: {
          raw: '<p><a href="https://destination.example/application-guide/">Application guide</a> <a href="https://manufacturer.example/specification/">Manufacturer specification</a></p>',
        },
      },
    });
    global.fetch = jest.fn(async (url) => ({ ok: true, url: String(url) })) as typeof fetch;

    const authority = await resolveSiteStudioProductAuthority({ site, product: product("https://destination.example/exact-product/"), products: [] });

    expect(authority.internalLinkCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://destination.example/application-guide/", anchorText: "Application guide", external: false }),
    ]));
    expect(authority.externalReferenceCandidates).toEqual([
      expect.objectContaining({ url: "https://manufacturer.example/specification/", anchorText: "Manufacturer specification", external: true }),
    ]);
    expect(authority.selectedExternalReferences).toEqual([]);
  });

  test("renders the selected canonical link once with its natural product anchor", () => {
    const canonical = {
      kind: "canonical_product" as const,
      url: "https://destination.example/exact-product/",
      anchorText: "Exact Product",
      source: "PRODUCT_INTELLIGENCE" as const,
      destinationValid: true,
      external: false,
    };
    const authority = { selectedInternalLinks: [canonical] } as SiteStudioProductAuthority;
    const first = renderSiteStudioAuthorityLinks({ html: "<h1>Page</h1><p>Introduction.</p><p>Details.</p>", authority });
    const second = renderSiteStudioAuthorityLinks({ html: first.html, authority });
    expect(first.rendered).toEqual([canonical]);
    expect(first.html).toContain('<a href="https://destination.example/exact-product/">Exact Product</a>');
    expect(second.html).toBe(first.html);
  });

  test("escapes canonical authority before rendering HTML", () => {
    const canonical = {
      kind: "canonical_product" as const,
      url: "https://destination.example/exact-product/?family=film&format=wide",
      anchorText: 'Exact <Product> & "Film"',
      source: "PRODUCT_INTELLIGENCE" as const,
      destinationValid: true,
      external: false,
    };
    const authority = { selectedInternalLinks: [canonical] } as SiteStudioProductAuthority;

    const rendered = renderSiteStudioAuthorityLinks({ html: "<p>Introduction.</p>", authority });

    expect(rendered.html).toContain('href="https://destination.example/exact-product/?family=film&amp;format=wide"');
    expect(rendered.html).toContain("Exact &lt;Product&gt; &amp; &quot;Film&quot;");
  });
});