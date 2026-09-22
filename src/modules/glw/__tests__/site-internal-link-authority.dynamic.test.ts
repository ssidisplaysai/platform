jest.mock("server-only", () => ({}));

const mockGetProductById = jest.fn();

jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: (...args: unknown[]) => mockGetProductById(...args),
}));

import {
  resolveGlwAllowedInternalLinks,
  resolveGlwProductAuthority,
} from "../site-internal-link-authority";

describe("GLW dynamic product authority resolver", () => {
  beforeEach(() => {
    mockGetProductById.mockReset();
    mockGetProductById.mockReturnValue({
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      organizationId: "ssi",
      productName: "Fan Cooled Projector Enclosures",
      displayName: "Fan Cooled Projector Enclosures",
      slug: "fan-cooled-projector-enclosures",
      siteAssignments: [
        {
          siteId: "site-ssi-projectorenclosure",
          enabledForSite: true,
          publicationStatus: "ready",
          visibility: "site_visible",
          siteSpecificSlug: "fan-cooled-projector-enclosures",
          siteSpecificDisplayName: "Fan Cooled Projector Enclosures",
        },
      ],
    });
  });

  test("resolves canonical product identity from repository assignment", () => {
    expect(resolveGlwProductAuthority({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
    })).toEqual({
      path: "/fan-cooled-projector-enclosures/",
      anchorText: "Fan Cooled Projector Enclosures",
    });
  });

  test("fails closed when organization or site does not match the canonical assignment", () => {
    expect(resolveGlwProductAuthority({
      organizationId: "other-org",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
    })).toBeNull();

    expect(resolveGlwProductAuthority({
      organizationId: "ssi",
      siteId: "site-other",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
    })).toBeNull();
  });

  test("returns only the campaign product link for a valid state child path", () => {
    expect(resolveGlwAllowedInternalLinks({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      stateCode: "TX",
      canonicalPath: "/fan-cooled-projector-enclosures/texas/",
    })).toEqual([
      {
        href: "/fan-cooled-projector-enclosures/",
        anchorText: "Fan Cooled Projector Enclosures",
        authorityClass: "product",
      },
    ]);
  });

  test("fails closed when the canonical path is not a state child route", () => {
    expect(resolveGlwAllowedInternalLinks({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      stateCode: "TX",
      canonicalPath: "/fan-cooled-projector-enclosures/texas/dallas/",
    })).toEqual([]);
  });
});
