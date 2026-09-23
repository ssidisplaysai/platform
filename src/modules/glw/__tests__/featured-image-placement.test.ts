import {
  glwContentOwnsPrimaryHero,
  shouldInsertGlwInlineHero,
} from "../featured-image-placement";

describe("GLW featured-image placement", () => {
  test("ProjectorEnclosure rich composition owns its primary hero", () => {
    const html = '<main><section data-reference-section="HERO">Hero</section></main>';
    expect(glwContentOwnsPrimaryHero(html)).toBe(true);
    expect(shouldInsertGlwInlineHero(html)).toBe(false);
  });

  test("Outdoor Sphere rich composition owns its primary hero", () => {
    const html = '<main><section data-genesis-hero="true">Hero</section></main>';
    expect(glwContentOwnsPrimaryHero(html)).toBe(true);
    expect(shouldInsertGlwInlineHero(html)).toBe(false);
  });

  test("plain article content still receives an inline hero", () => {
    const html = '<article><h1>Page title</h1><p>Body content.</p></article>';
    expect(glwContentOwnsPrimaryHero(html)).toBe(false);
    expect(shouldInsertGlwInlineHero(html)).toBe(true);
  });
});
