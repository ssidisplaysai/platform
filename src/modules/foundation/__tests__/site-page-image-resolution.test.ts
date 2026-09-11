import { resolveSitePageImageRequirement } from "../site-page-image-resolution";

describe("site page image requirement resolution", () => {
  test("treats a fabrication visual as purpose that can use generated or owner provenance", () => {
    expect(resolveSitePageImageRequirement({ source: "FABRICATION_VISUAL" } as never)).toEqual({
      purpose: "FABRICATION_VISUAL",
      policy: "GENERATED_OR_OWNER_ASSET",
      generatedVisualAllowed: true,
      ownerAssetAllowed: true,
    });
  });

  test("prohibits generation only through an explicit owner-asset-only policy", () => {
    expect(resolveSitePageImageRequirement({ source: "FABRICATION_VISUAL", resolutionPolicy: "OWNER_ASSET_ONLY" } as never)).toMatchObject({
      purpose: "FABRICATION_VISUAL",
      policy: "OWNER_ASSET_ONLY",
      generatedVisualAllowed: false,
      ownerAssetAllowed: true,
    });
  });
});