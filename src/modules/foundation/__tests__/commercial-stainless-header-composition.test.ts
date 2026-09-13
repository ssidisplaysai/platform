import { buildCommercialStainlessHeaderComposition, COMMERCIAL_STAINLESS_HEADER_COMPOSITION_VERSION } from "../wordpress-theme-shell-repair";

describe("Commercial Stainless global header composition", () => {
  it("binds the existing navigation and creates a responsive 1240px header with a red final CTA", () => {
    const html = buildCommercialStainlessHeaderComposition(72);
    expect(COMMERCIAL_STAINLESS_HEADER_COMPOSITION_VERSION).toBe("commercial-stainless-header-composition-v1");
    expect(html).toContain('"ref":72');
    expect(html).toContain("width:min(1240px,calc(100% - 48px))");
    expect(html).toContain("last-child>.wp-block-navigation-item__content");
    expect(html).toContain("background:#d62828;color:#fff");
    expect(html).toContain("width:44px;height:44px");
    expect(html).toContain("flex-wrap:nowrap!important");
    expect(html).toContain("@media(max-width:1100px)");
  });

  it("rejects missing or invalid navigation authority", () => {
    expect(() => buildCommercialStainlessHeaderComposition(0)).toThrow("THEME_HEADER_NAVIGATION_ID_INVALID");
  });
});