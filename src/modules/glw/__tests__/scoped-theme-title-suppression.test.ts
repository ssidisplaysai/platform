import { applyScopedThemeFeaturedMediaSuppression, applyScopedThemeTitleSuppression } from "../scoped-theme-title-suppression";

describe("scoped theme title suppression", () => {
  const html = [
    "<!-- wp:html -->",
    "<style>.saw{color:#111}</style>",
    "<main class=\"saw\">",
    "<h1>Outdoor Digital Sphere in Florida</h1>",
    "<p>Planning content.</p>",
    "</main>",
    "<!-- /wp:html -->",
  ].join("");

  test("injects page-scoped theme title suppression and preserves generated H1", () => {
    const result = applyScopedThemeTitleSuppression({
      contentHtml: html,
      wordpressObjectId: "20163",
    });

    expect(result.mutated).toBe(true);
    expect(result.contentHtml).toContain("body.page-id-20163 .page-title.the-title,body.page-id-20163 .page-header .entry-title,body.page-id-20163 .entry-header .entry-title{display:none!important}");
    expect(result.contentHtml).not.toContain(".post-media.single-image{display:none!important}");
    expect((result.contentHtml.match(/<h1\b/gi) ?? []).length).toBe(1);
  });

  test("injects page-scoped native featured media suppression without hiding generated content images", () => {
    const result = applyScopedThemeFeaturedMediaSuppression({
      contentHtml: html,
      wordpressObjectId: "13167",
    });

    expect(result.mutated).toBe(true);
    expect(result.contentHtml).toContain("body.page-id-13167 .featured-image.page-header-image-single");
    expect(result.contentHtml).toContain("body.page-id-13167 .inside-article > .post-image");
    expect(result.contentHtml).not.toContain(".saw img{display:none");
    expect((result.contentHtml.match(/<h1\b/gi) ?? []).length).toBe(1);
  });

  test("is idempotent when the scoped suppression already exists", () => {
    const once = applyScopedThemeTitleSuppression({
      contentHtml: html,
      wordpressObjectId: "20163",
    });
    const twice = applyScopedThemeTitleSuppression({
      contentHtml: once.contentHtml,
      wordpressObjectId: "20163",
    });

    expect(twice.mutated).toBe(false);
    expect(twice.alreadySuppressed).toBe(true);
    expect(twice.contentHtml).toBe(once.contentHtml);
  });

  test("fails closed for invalid WordPress object id", () => {
    expect(() => applyScopedThemeTitleSuppression({ contentHtml: html, wordpressObjectId: "abc" })).toThrow(
      "SCOPED_THEME_TITLE_SUPPRESSION_WORDPRESS_OBJECT_ID_INVALID",
    );
  });
});
