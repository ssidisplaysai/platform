jest.mock("server-only", () => ({}));

import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";

import {
  resolveGlwAllowedInternalLinks,
  type GlwInternalGeographyRouteAuthority,
} from "../site-internal-link-authority";

const product = FOUNDATION_PRODUCTS.find(
  (entry) => entry.productId === "prod-indoor-digital-sphere",
)!;

const request = {
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  productId: "prod-indoor-digital-sphere",
  stateCode: "CO",
  canonicalPath: "/indoor-digital-sphere/colorado/",
};

describe("GLW internal link authority", () => {
  test("derives the Colorado product parent from Genesis product and routing authority", () => {
    expect(resolveGlwAllowedInternalLinks(request, {
      getProduct: () => product,
    })).toEqual([
      {
        href: "/indoor-digital-sphere/",
        anchorText: "Indoor Digital Sphere",
        authorityClass: "product",
      },
    ]);
  });

  test("does not fabricate a geography route when Genesis has none", () => {
    const links = resolveGlwAllowedInternalLinks(request, {
      getProduct: () => product,
      geographyRoutes: [],
    });

    expect(links.filter(
      (link) => link.authorityClass === "geography",
    )).toEqual([]);
  });

  test("accepts an explicitly registered geography route", () => {
    const geographyRoutes: readonly GlwInternalGeographyRouteAuthority[] = [
      {
        organizationId: request.organizationId,
        siteId: request.siteId,
        productId: request.productId,
        stateCode: "CO",
        href: "/digital-spheres/colorado/",
        anchorText: "Digital Spheres in Colorado",
      },
    ];

    expect(resolveGlwAllowedInternalLinks(request, {
      getProduct: () => product,
      geographyRoutes,
    })).toEqual(expect.arrayContaining([
      {
        href: "/digital-spheres/colorado/",
        anchorText: "Digital Spheres in Colorado",
        authorityClass: "geography",
      },
    ]));
  });

  test("rejects geography routes owned by another site or product", () => {
    const geographyRoutes: readonly GlwInternalGeographyRouteAuthority[] = [
      {
        organizationId: request.organizationId,
        siteId: "site-other",
        productId: request.productId,
        stateCode: "CO",
        href: "/digital-spheres/colorado/",
        anchorText: "Digital Spheres in Colorado",
      },
      {
        organizationId: request.organizationId,
        siteId: request.siteId,
        productId: "prod-other",
        stateCode: "CO",
        href: "/other/colorado/",
        anchorText: "Other Colorado",
      },
    ];

    expect(resolveGlwAllowedInternalLinks(request, {
      getProduct: () => product,
      geographyRoutes,
    })).toEqual([
      expect.objectContaining({
        href: "/indoor-digital-sphere/",
        authorityClass: "product",
      }),
    ]);
  });

  test("rejects the current page as a geography self-link", () => {
    const geographyRoutes: readonly GlwInternalGeographyRouteAuthority[] = [
      {
        organizationId: request.organizationId,
        siteId: request.siteId,
        productId: request.productId,
        stateCode: "CO",
        href: request.canonicalPath,
        anchorText: "Colorado Indoor Digital Sphere",
      },
    ];

    expect(resolveGlwAllowedInternalLinks(request, {
      getProduct: () => product,
      geographyRoutes,
    })).toEqual([
      expect.objectContaining({
        href: "/indoor-digital-sphere/",
        authorityClass: "product",
      }),
    ]);
  });

  test("fails closed for mismatched organization, site assignment, state, or canonical route", () => {
    const cases = [
      { ...request, organizationId: "other-org" },
      { ...request, siteId: "site-other" },
      { ...request, stateCode: "ZZ" },
      { ...request, canonicalPath: "/fabricated/colorado/" },
    ];

    for (const candidate of cases) {
      expect(resolveGlwAllowedInternalLinks(candidate, {
        getProduct: () => product,
      })).toEqual([]);
    }
  });
});
