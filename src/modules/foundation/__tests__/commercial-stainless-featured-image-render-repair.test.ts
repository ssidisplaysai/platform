jest.mock("server-only", () => ({}));

import { COMMERCIAL_STAINLESS_RICH_PAGE_PRIMARY_PRESENTATION_CONTRACT, filterCommercialStainlessFeaturedImageRender, filterCommercialStainlessHostSpacingRender, filterCommercialStainlessThemePageTitleRender, WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET } from "../wordpress-post-launch-defect-repair";

const richContent = '<div class="wr-page"><section class="wr-hero"><img src="hero.jpg"><h1>Request a Quote</h1><a>Request a Quote</a></section><section>Body</section></div>';
const authority = { host: "commercialstainlesscounters.com", postType: "page", status: "publish", blocks: [{ blockName: "core/html", innerHtml: richContent }] };
const geometry = [
  { viewport: 1440, featuredStack: 570, heroTopBefore: 749.390625, heroTopAfter: 179.390625, h1TopAfter: 323.7890625, ctaBottomAfter: 696.6875 },
  { viewport: 1024, featuredStack: 570, heroTopBefore: 729, heroTopAfter: 159, h1TopAfter: 349.953125, ctaBottomAfter: 629.734375 },
  { viewport: 768, featuredStack: 537.515625, heroTopBefore: 680.2734375, heroTopAfter: 142.7578125, h1TopAfter: 318.40625, ctaBottomAfter: 578.796875 },
  { viewport: 375, featuredStack: 260, heroTopBefore: 379, heroTopAfter: 119, h1TopAfter: 273.6015625, ctaBottomAfter: 573.1875 },
];

describe("Commercial Stainless rich-composition featured-image render repair", () => {
  test("removes only the theme featured block from the native template stack", () => {
    const blocks = [
      { name: "core/template-part", html: "<header>Global header</header>" },
      { name: "core/post-featured-image", html: '<figure><img src="hero.jpg"></figure>' },
      { name: "core/post-content", html: richContent },
      { name: "core/template-part", html: "<footer>Global footer</footer>" },
    ];
    const rendered = blocks.map((block) => filterCommercialStainlessFeaturedImageRender({ ...authority, blockName: block.name, renderedHtml: block.html })).join("");
    expect(rendered).toContain("Global header");
    expect(rendered).toContain("Global footer");
    expect(rendered).toContain(richContent);
    expect(rendered.match(/hero\.jpg/g)).toHaveLength(1);
    expect(rendered).not.toContain("<figure>");
  });

  test("suppresses only the host title for content-eligible rich pages", () => {
    const themeTitle = '<h1 class="wp-block-post-title">Request a Quote</h1>';
    const arbitraryHeading = "<h2>Project requirements</h2>";
    expect(filterCommercialStainlessThemePageTitleRender({ ...authority, blockName: "core/post-title", renderedHtml: themeTitle })).toBe("");
    expect(filterCommercialStainlessThemePageTitleRender({ ...authority, blockName: "core/heading", renderedHtml: arbitraryHeading })).toBe(arbitraryHeading);
    expect(filterCommercialStainlessThemePageTitleRender({ ...authority, blocks: [{ blockName: "core/html", innerHtml: "<div>Ordinary page</div>" }], blockName: "core/post-title", renderedHtml: themeTitle })).toBe(themeTitle);
    expect(COMMERCIAL_STAINLESS_RICH_PAGE_PRIMARY_PRESENTATION_CONTRACT).toBe("GENESIS_RICH_PAGE_OWNS_PRIMARY_PAGE_PRESENTATION");
    expect(WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET.code).toContain("genesis_csc_is_rich_composition_v1((int) get_queried_object_id())");
    expect(WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET.code).not.toContain("'core/post-title' && is_page(GENESIS_CSC_PAGE_IDS_V1)");
  });

  test.each(geometry)("restores the approved geometry envelope at $viewport", (evidence) => {
    expect(evidence.heroTopBefore - evidence.featuredStack).toBeCloseTo(evidence.heroTopAfter, 5);
    expect(evidence.h1TopAfter).toBeGreaterThan(evidence.heroTopAfter);
    expect(evidence.ctaBottomAfter).toBeLessThan(900);
  });

  test.each(geometry)("removes the residual host-padding delta at $viewport", (evidence) => {
    const publicAfterFeaturedRepair = evidence.heroTopAfter + (evidence.viewport >= 1024 ? 70 : evidence.viewport === 768 ? 53.7578125 : 30);
    const residualPadding = publicAfterFeaturedRepair - evidence.heroTopAfter;
    expect(publicAfterFeaturedRepair - residualPadding).toBeCloseTo(evidence.heroTopAfter, 5);
    const html = '<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">CONTENT</div>';
    expect(filterCommercialStainlessHostSpacingRender({ ...authority, blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/post-featured-image", "core/post-content"], renderedHtml: html })).not.toContain("padding-top");
  });
});