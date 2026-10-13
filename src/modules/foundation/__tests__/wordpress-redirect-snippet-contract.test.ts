import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "wordpress-snippets/genesis-ssi-redirect-authority-v1.php"), "utf8");

describe("Genesis SSI redirect authority snippet contract", () => {
  test("is a Code Snippets PHP body without embedded credentials", () => {
    expect(source).not.toContain("<?php");
    expect(source).not.toMatch(/application_password|authorization:\s*basic|password\s*=/i);
  });

  test("registers one authenticated exact GET POST DELETE route", () => {
    expect(source).toContain("register_rest_route('ssi/v1', '/redirect'");
    expect(source).toContain("WP_REST_Server::READABLE");
    expect(source).toContain("WP_REST_Server::CREATABLE");
    expect(source).toContain("WP_REST_Server::DELETABLE");
    expect(source.match(/'permission_callback' => 'genesis_ssi_redirect_v1_permission'/g)).toHaveLength(3);
    expect(source).toContain("current_user_can('edit_others_pages')");
  });

  test("uses one bounded site-owned option and exact-path frontend lookup", () => {
    expect(source).toContain("genesis_ssi_redirect_registry_v1");
    expect(source).toContain("GENESIS_SSI_REDIRECT_V1_LIMIT = 100");
    expect(source).toContain("GENESIS_SSI_REDIRECT_V1_HOST = 'projectorenclosure.com'");
    expect(source).toContain("isset($registry[$source])");
    expect(source).toContain("wp_safe_redirect(home_url($destination), 301");
    expect(source).not.toMatch(/\.htaccess|update_post_meta|wp_update_post|query_posts|preg_replace\s*\(\s*\$source/i);
  });

  test("rejects unsafe status, paths, self loops, chains, and conflicting ownership", () => {
    expect(source).toContain("Only permanent status 301 is supported.");
    expect(source).toContain("without regex, wildcard, or encoded syntax");
    expect(source).toContain("Source and destination must differ.");
    expect(source).toContain("Redirect chains and loops are not permitted.");
    expect(source).toContain("Exact current identity and destination are required to replace it.");
  });

  test("requires exact identity for deletion and supports explicit not-found state", () => {
    expect(source).toContain("Exact redirect id, source, and destination are required.");
    expect(source).toContain("Exact redirect identity, source, and destination did not match.");
    expect(source).toContain("'deleted' => false, 'exists' => false");
    expect(source).toContain("'deleted' => true");
  });

  test("excludes WordPress system execution surfaces", () => {
    for (const marker of ["is_admin()", "wp_doing_ajax()", "wp_doing_cron()", "is_feed()", "REST_REQUEST", "XMLRPC_REQUEST", "WP_CLI"]) {
      expect(source).toContain(marker);
    }
  });
});