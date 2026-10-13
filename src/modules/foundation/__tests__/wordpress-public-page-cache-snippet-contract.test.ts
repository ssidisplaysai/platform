import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "wordpress-snippets/genesis-ssi-public-page-cache-authority-v1.php"), "utf8");

describe("Genesis SSI public page-cache authority", () => {
  test("is authenticated, site-bound, and exact-target scoped", () => {
    expect(source).toContain("GENESIS_SSI_PAGE_CACHE_V1_HOST = 'projectorenclosure.com'");
    expect(source).toContain("current_user_can('edit_others_pages')");
    expect(source).toContain("current_user_can('edit_post', $page_id)");
    expect(source).toContain("$keys !== array('action', 'page_id', 'url')");
    expect(source).toContain("Page ID and canonical URL do not identify the same page.");
    expect(source).not.toMatch(/file_get_contents|unlink|glob\s*\(|update_option|activate_plugin|switch_theme|eval\s*\(/i);
  });

  test("handles the front page as both an object and root URL", () => {
    expect(source).toContain("get_option('show_on_front') === 'page'");
    expect(source).toContain("get_option('page_on_front') === $page_id");
    expect(source).toContain("trailingslashit(home_url('/'))");
    expect(source).toContain("do_action('litespeed_purge_url', $url)");
  });

  test("uses page-scoped adapters and fails closed without one", () => {
    expect(source).toContain("rocket_clean_post($page_id)");
    expect(source).toContain("do_action('litespeed_purge_post', $page_id)");
    expect(source).toContain("w3tc_flush_post($page_id)");
    expect(source).toContain("class_exists('WPaaS\\\\Cache')");
    expect(source).toContain("WP_CONTENT_DIR . '/advanced-cache.php'");
    expect(source).toContain("'state' => 'UNAVAILABLE'");
    expect(source).toContain("'state' => 'CLEARED'");
    expect(source).not.toMatch(/wp_cache_flush|rocket_clean_domain|w3tc_flush_all|litespeed_purge_all|purge_cache\(\)/i);
  });
});