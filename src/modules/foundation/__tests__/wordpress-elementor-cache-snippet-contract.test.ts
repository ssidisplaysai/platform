import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "wordpress-snippets/genesis-ssi-elementor-cache-authority-v1.php"),
  "utf8",
);

describe("Genesis SSI Elementor cache authority snippet contract", () => {
  test("is an SSI Snippets PHP body without credentials", () => {
    expect(source).not.toContain("<?php");
    expect(source).not.toMatch(/application_password|authorization:\s*basic|password\s*=/i);
  });

  test("registers one POST-only authenticated site-bound route", () => {
    expect(source).toContain("register_rest_route('ssi/v1', '/elementor-cache'");
    expect(source).toContain("'methods' => WP_REST_Server::CREATABLE");
    expect(source).not.toContain("WP_REST_Server::READABLE");
    expect(source).not.toContain("WP_REST_Server::DELETABLE");
    expect(source).toContain("GENESIS_SSI_ELEMENTOR_CACHE_V1_HOST = 'projectorenclosure.com'");
    expect(source).toContain("current_user_can('edit_others_pages')");
    expect(source).toContain("'status' => 401");
    expect(source).toContain("'status' => 403");
  });

  test("accepts only an empty body or exact clear action", () => {
    expect(source).toContain("$keys !== array() && $keys !== array('action')");
    expect(source).toContain("$params['action'] !== 'clear'");
    expect(source).toContain("Only the exact action field is accepted.");
    expect(source).toContain("Only action clear is supported.");
  });

  test("delegates only to the installed Elementor files manager", () => {
    expect(source).toContain("class_exists('Elementor\\\\Plugin')");
    expect(source).toContain("\\Elementor\\Plugin::$instance");
    expect(source).toContain("is_callable(array($plugin->files_manager, 'clear_cache'))");
    expect(source).toContain("$plugin->files_manager->clear_cache()");
    expect(source).toContain("'authority' => 'elementor_files_manager'");
  });

  test("reports unavailable and failed operations without fabricating success", () => {
    expect(source).toContain("'code' => 'elementor_cache_api_unavailable'");
    expect(source).toContain("'code' => 'elementor_cache_clear_failed'");
    expect(source).toContain("'cleared' => false");
    expect(source.match(/'cleared' => true/g)).toHaveLength(1);
  });

  test("contains no arbitrary mutation or proxy surfaces", () => {
    expect(source).not.toMatch(/update_post_meta|wp_update_post|delete_post|update_option|delete_option|unlink|glob\s*\(|file_get_contents|curl_|wp_remote_|activate_plugin|switch_theme/i);
    expect(source).not.toMatch(/post_id|page_id|file_path|cache_name|redirect/i);
  });
});
