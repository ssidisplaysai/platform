jest.mock("server-only", () => ({}));

import {
  renderGlwAllowedInternalLinks,
  resolveGlwAllowedInternalLinks,
} from "../site-internal-link-authority";

function coloradoRequest() {
  return {
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-indoor-digital-sphere",
    stateCode: "CO",
    canonicalPath:
      "/indoor-digital-sphere/colorado/",
  };
}

describe("GLW site internal link authority", () => {
  test("returns only the proven product authority for Colorado", () => {
    expect(
      resolveGlwAllowedInternalLinks(
        coloradoRequest(),
      ),
    ).toEqual([
      {
        href: "/indoor-digital-sphere/",
        anchorText: "Indoor Digital Sphere",
        authorityClass: "product",
      },
    ]);
  });

  test("does not register a geography route for Colorado", () => {
    const links =
      resolveGlwAllowedInternalLinks(
        coloradoRequest(),
      );

    expect(
      links.some(
        (link) =>
          link.authorityClass === "geography",
      ),
    ).toBe(false);
  });

  test("fails closed for an unknown product", () => {
    expect(
      resolveGlwAllowedInternalLinks({
        ...coloradoRequest(),
        productId: "prod-unknown",
      }),
    ).toEqual([]);
  });

  test("fails closed for the wrong site", () => {
    expect(
      resolveGlwAllowedInternalLinks({
        ...coloradoRequest(),
        siteId: "site-other",
      }),
    ).toEqual([]);
  });

  test("rejects the product page as its own internal link target", () => {
    expect(
      resolveGlwAllowedInternalLinks({
        ...coloradoRequest(),
        canonicalPath:
          "/indoor-digital-sphere/",
      }),
    ).toEqual([]);
  });

  test("fails closed for a non-state-service hierarchy", () => {
    expect(
      resolveGlwAllowedInternalLinks({
        ...coloradoRequest(),
        canonicalPath:
          "/indoor-digital-sphere/colorado/denver/",
      }),
    ).toEqual([]);
  });

  test("renders the approved product link when generation omitted it", () => {
    const links =
      resolveGlwAllowedInternalLinks(
        coloradoRequest(),
      );

    const result =
      renderGlwAllowedInternalLinks({
        html: "<h1>Indoor Digital Sphere in Colorado</h1><p>Commercial display planning.</p>",
        links,
      });

    expect(result.rendered).toHaveLength(1);
    expect(result.html).toContain(
      '<a href="/indoor-digital-sphere/">Indoor Digital Sphere</a>',
    );
  });

  test("preserves an existing approved product link without duplication", () => {
    const links =
      resolveGlwAllowedInternalLinks(
        coloradoRequest(),
      );

    const existing =
      '<a href="/indoor-digital-sphere/">Indoor Digital Sphere</a>';

    const result =
      renderGlwAllowedInternalLinks({
        html: `<h1>Indoor Digital Sphere in Colorado</h1><p>See ${existing} for details.</p>`,
        links,
      });

    expect(
      result.html.split(existing).length - 1,
    ).toBe(1);

    expect(result.rendered).toHaveLength(1);
  });

  test("renders nothing when internal-link authority fails closed", () => {
    const links =
      resolveGlwAllowedInternalLinks({
        ...coloradoRequest(),
        siteId: "site-other",
      });

    const original =
      "<h1>Indoor Digital Sphere in Colorado</h1><p>Commercial display planning.</p>";

    const result =
      renderGlwAllowedInternalLinks({
        html: original,
        links,
      });

    expect(result.rendered).toEqual([]);
    expect(result.html).toBe(original);
  });

});
