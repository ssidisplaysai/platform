jest.mock("server-only", () => ({}));
import { WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET } from "../wordpress-post-launch-defect-repair";
describe("CSC post-launch defect repair", () => {
  test("removes only theme post titles, clears only the default tagline, and binds exact market IDs", () => {
    const code = WORDPRESS_POST_LAUNCH_REPAIR_SNIPPET.code;
    expect(code).toContain("get_option('blogdescription') === 'Just another WordPress site'");
    expect(code).toContain("($block['blockName'] ?? '') === 'core/post-title'");
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
});
