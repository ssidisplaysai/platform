jest.mock("server-only", () => ({}));
import { filterCommercialStainlessFeaturedImageRender, filterCommercialStainlessHostSpacingRender, isCommercialStainlessRichCompositionEligible, WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET } from "../wordpress-post-launch-defect-repair";

const base = { host: "commercialstainlesscounters.com", postType: "page", status: "publish" };
const richBlock = { blockName: "core/html", innerHtml: '<style>.wr-page{width:100%}.wr-hero{min-height:610px}</style><div class="wr-page"><section class="wr-hero"><img src="hero.jpg"><h1>Page</h1></section></div>' };
describe("CSC post-launch defect repair", () => {
  test("removes only theme post titles, clears only the default tagline, and binds exact market IDs", () => {
    const code = WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET.code;
    expect(code).toContain("get_option('blogdescription') === 'Just another WordPress site'");
    expect(code).toContain("get_option('blogname') === 'My blog'");
    expect(code).toContain("update_option('blogname', 'Commercial Stainless Counters', true)");
    expect(code).toContain("($block['blockName'] ?? '') === 'core/post-title'");
    expect(code).toContain("($block['blockName'] ?? '') === 'core/post-featured-image'");
    expect(code).toContain("genesis_csc_is_rich_composition_v1");
    expect(code).toContain("parse_blocks");
    expect(code).toContain("WP_HTML_Tag_Processor");
    expect(code).toContain("has_class('wr-page')");
    expect(code).toContain("has_class('wr-hero')");
    expect(code).toContain("padding-top");
    expect(code).toContain("var:preset|spacing|60");
    expect(code).toContain("in_array('core/post-featured-image', $child_names, true)");
    expect(code).toContain("in_array('core/post-content', $child_names, true)");
    expect(code).toContain("is_page(GENESIS_CSC_PAGE_IDS_V1)");
    for (const [id, path] of [[17, "markets/education"], [18, "markets/foodservice"], [19, "markets/healthcare"], [20, "markets/hospitality"], [21, "markets/industrial"], [22, "markets/labs"]]) expect(code).toContain(`${id} => '${path}'`);
    expect(code).toContain("add_rewrite_rule");
    expect(code).toContain("flush_rewrite_rules(false)");
    expect(code).toContain("add_filter('page_link'");
    expect(code).toContain("add_filter('post_type_link'");
    expect(code).toContain("add_filter('get_canonical_url'");
    expect(code).toContain("add_filter('wpseo_canonical'");
    expect(code).toContain("add_filter('wpseo_opengraph_url'");
    expect(code).toContain("add_filter('rest_prepare_page'");
    expect(code).toContain("add_filter('rest_post_dispatch'");
    expect(code).toContain("add_filter('redirect_canonical'");
    expect(code).not.toMatch(/wp_insert_post|wp_update_post|media_handle|update_post_meta/);
  });

  test("suppresses only the theme featured block for an eligible rich composition", () => {
    const input = { ...base, blocks: [richBlock] };
    expect(isCommercialStainlessRichCompositionEligible(input)).toBe(true);
    expect(filterCommercialStainlessFeaturedImageRender({ ...input, blockName: "core/post-featured-image", renderedHtml: '<figure class="wp-block-post-featured-image">Theme media</figure>' })).toBe("");
    expect(filterCommercialStainlessFeaturedImageRender({ ...input, blockName: "core/html", renderedHtml: richBlock.innerHtml })).toBe(richBlock.innerHtml);
  });

  test.each([
    ["ordinary page with featured image", { ...base, blocks: [{ blockName: "core/paragraph", innerHtml: "<p>Ordinary</p>" }] }],
    ["ordinary page without featured image", { ...base, blocks: [{ blockName: "core/html", innerHtml: "<div>Ordinary</div>" }] }],
    ["unrelated wr-like text", { ...base, blocks: [{ blockName: "core/html", innerHtml: "<p>wr-page and wr-hero are words</p>" }] }],
    ["legacy Commercial Stainless page", { ...base, blocks: [{ blockName: "core/html", innerHtml: '<div class="gvs-page"><section class="gvs-hero"></section></div>' }] }],
    ["homepage legacy authority", { ...base, blocks: [{ blockName: "core/html", innerHtml: '<main class="gvs-page">Home</main>' }] }],
    ["Design-Build current authority", { ...base, blocks: [{ blockName: "core/html", innerHtml: '<div class="gvs-page"><h1>Design-Build</h1></div>' }] }],
    ["non-Commercial-Stainless page", { ...base, host: "projectorenclosure.com", blocks: [richBlock] }],
    ["draft rich content", { ...base, status: "draft", blocks: [richBlock] }],
  ])("preserves featured rendering for %s", (_name, input) => {
    expect(isCommercialStainlessRichCompositionEligible(input)).toBe(false);
    expect(filterCommercialStainlessFeaturedImageRender({ ...input, blockName: "core/post-featured-image", renderedHtml: "FEATURED" })).toBe("FEATURED");
  });

  test("supports structurally nested approved HTML blocks without object-number eligibility", () => {
    expect(isCommercialStainlessRichCompositionEligible({ ...base, blocks: [{ blockName: "core/group", innerBlocks: [richBlock] }] })).toBe(true);
  });

  test("preserves featured-media and SEO authority because the filter is render-only", () => {
    const page = { featuredMediaId: 70, seoSocialImageId: 70, postContent: richBlock.innerHtml };
    const output = filterCommercialStainlessFeaturedImageRender({ ...base, blocks: [richBlock], blockName: "core/post-featured-image", renderedHtml: "FEATURED" });
    expect(output).toBe("");
    expect(page).toEqual({ featuredMediaId: 70, seoSocialImageId: 70, postContent: richBlock.innerHtml });
  });

  test("removes only the eligible template host group's top padding", () => {
    const renderedHtml = '<div class="wp-block-group alignfull has-global-padding" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><div class="wp-block-post-content"></div></div>';
    const result = filterCommercialStainlessHostSpacingRender({ ...base, blocks: [richBlock], blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/post-featured-image", "core/post-title", "core/post-content"], renderedHtml });
    expect(result).not.toContain("padding-top");
    expect(result).toContain("padding-bottom:var(--wp--preset--spacing--60)");
    expect(result).toContain("wp-block-post-content");
  });

  test.each([
    ["ordinary content", { ...base, blocks: [{ blockName: "core/paragraph", innerHtml: "ordinary" }], blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/post-featured-image", "core/post-content"] }],
    ["wrong group alignment", { ...base, blocks: [richBlock], blockName: "core/group", align: "wide", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/post-featured-image", "core/post-content"] }],
    ["wrong spacing preset", { ...base, blocks: [richBlock], blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|50", directInnerBlockNames: ["core/post-featured-image", "core/post-content"] }],
    ["unrelated group", { ...base, blocks: [richBlock], blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/paragraph"] }],
    ["non-CSC host", { ...base, host: "projectorenclosure.com", blocks: [richBlock], blockName: "core/group", align: "full", paddingTop: "var:preset|spacing|60", directInnerBlockNames: ["core/post-featured-image", "core/post-content"] }],
  ])("preserves host spacing for %s", (_name, input) => {
    const renderedHtml = '<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">CONTENT</div>';
    expect(filterCommercialStainlessHostSpacingRender({ ...input, renderedHtml })).toBe(renderedHtml);
  });
});
