jest.mock("server-only", () => ({}));

import {
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
});
