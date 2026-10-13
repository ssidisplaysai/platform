jest.mock("server-only", () => ({}));

import { WORDPRESS_CANONICAL_HOST_SNIPPET } from "../wordpress-canonical-host";

describe("Commercial Stainless Counters canonical host authority", () => {
  test("pins WordPress URLs and redirects every noncanonical scheme or host in one hop", () => {
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.origin).toBe("https://commercialstainlesscounters.com");
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.code).toContain("update_option('home', GENESIS_CSC_CANONICAL_ORIGIN_V1, true)");
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.code).toContain("update_option('siteurl', GENESIS_CSC_CANONICAL_ORIGIN_V1, true)");
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.code).toContain("HTTP_X_FORWARDED_PROTO");
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.code).toContain("wp_safe_redirect(GENESIS_CSC_CANONICAL_ORIGIN_V1 . $request_uri, 301");
    expect(WORDPRESS_CANONICAL_HOST_SNIPPET.code).not.toMatch(/wp_update_post|wp_insert_post|update_post_meta|media_handle/);
  });
});
