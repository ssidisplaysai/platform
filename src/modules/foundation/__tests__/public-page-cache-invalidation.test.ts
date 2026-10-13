import { requirePublicPageCacheCleared } from "../public-page-cache-invalidation";

describe("public page-cache invalidation gate", () => {
  test.each(["REQUIRED", "FAILED", "UNAVAILABLE"] as const)(
    "fails closed for %s",
    (state) => {
      expect(() => requirePublicPageCacheCleared({ state, pageId: "3810", url: "https://projectorenclosure.com/", authority: null })).toThrow(`received ${state}`);
    },
  );

  test.each(["NOT_REQUIRED", "CLEARED"] as const)("accepts %s", (state) => {
    expect(() => requirePublicPageCacheCleared({ state, pageId: "3810", url: "https://projectorenclosure.com/", authority: state === "CLEARED" ? "certified_page_adapter" : null })).not.toThrow();
  });
});