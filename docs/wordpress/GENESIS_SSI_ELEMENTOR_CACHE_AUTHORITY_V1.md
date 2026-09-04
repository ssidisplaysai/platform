# Genesis SSI Elementor Cache Authority v1

Manually install `wordpress-snippets/genesis-ssi-elementor-cache-authority-v1.php` on `projectorenclosure.com` with SSI Snippets. Do not install it on `ssidisplays.com`.

## Runtime API

The snippet delegates to Elementor 4.2.4's files manager:

```php
\Elementor\Plugin::$instance->files_manager->clear_cache();
```

This is the same API used by Elementor's native `DELETE /elementor/v1/cache` controller. The native controller requires `manage_options`; this narrowly site-bound wrapper requires `edit_others_pages`, which the certified Genesis ProjectorEnclosure application-password identity already holds.

`clear_cache()` removes Elementor-generated CSS/cache files and their cache metadata. It does not update WordPress pages, post content, Elementor document JSON, media, Yoast fields, slugs, status, or redirects. Generated assets are recreated by subsequent frontend requests.

## Manual Installation

1. Sign in to `projectorenclosure.com/wp-admin/`.
2. Open **SSI Snippets > Add New**.
3. Choose **PHP**.
4. Set the title to **Genesis SSI Elementor Cache Authority v1**.
5. Paste the PHP artifact exactly. Do not add `<?php`.
6. Select **Run everywhere**.
7. Choose **Save + Activate**.
8. Confirm `/wp-json/` lists `/ssi/v1/elementor-cache` with POST only.

Do not edit either Homeline page or invoke the endpoint during installation.

## REST Contract

`POST /wp-json/ssi/v1/elementor-cache`

Accepted bodies:

- No body.
- `{ "action": "clear" }`

Any additional key or any other action returns HTTP 400. No post ID, cache name, filesystem path, or plugin operation is accepted.

Authentication uses standard WordPress application passwords. The endpoint requires:

- An authenticated user.
- `edit_others_pages`.
- WordPress `home_url()` bound to `projectorenclosure.com` after optional `www.` normalization.

Success response:

```json
{
  "ok": true,
  "cleared": true,
  "authority": "elementor_files_manager"
}
```

Unavailable API response, HTTP 503:

```json
{
  "ok": false,
  "cleared": false,
  "code": "elementor_cache_api_unavailable"
}
```

Runtime failure response, HTTP 500:

```json
{
  "ok": false,
  "cleared": false,
  "code": "elementor_cache_clear_failed"
}
```

Anonymous requests return 401. Authenticated users without `edit_others_pages`, or execution on any other site, return 403.

## Read-Only Pre-Certification Snapshot

Before the first cache call, persist exact authenticated state for pages 11852 and 10513:

- Raw `_elementor_data` and SHA-256.
- Raw `post_content` and SHA-256.
- Title, slug, status, parent, featured media, and modified timestamp.
- Yoast focus keyphrase, SEO title, and meta description.
- Canonical and robots values.
- Public HTML and SHA-256.
- `post-11852.css`, availability, size, and SHA-256.
- Exact redirect GET for `/homeline-projector-enclosure-info/`.

Expected baseline hashes:

- 11852 `_elementor_data`: `515b1470869e27e794c19c64ce65ffcd8bcbbfcdbea396c67223eae01282a762`
- 11852 `post_content`: `d609d63c95f4499d87b82ae80e60a6ba5767ca48a37d34670ef58cee1cd763f1`
- 10513 `_elementor_data`: `44363e8a2931a967dd2a8f22398f528b43e68da4f0673f574a9f1851b377a111`
- 10513 `post_content`: `eb2376fc1a497e3282b45f3b436c4d1c60d07a1ebfc74a030de16af4e98466f1`

Stop before certification if any page or redirect invariant differs.

## Live Certification

1. Confirm `/wp-json/` advertises exactly POST for `/ssi/v1/elementor-cache`.
2. POST anonymously with `{ "action": "clear" }`; require HTTP 401.
3. POST using an authenticated insufficient-capability identity, when safely available; require HTTP 403. Do not weaken permissions to manufacture this test.
4. POST with malformed JSON, an unknown field, and a non-`clear` action; require HTTP 400 and no success response.
5. POST with the existing ProjectorEnclosure application-password identity and `{ "action": "clear" }`.
6. Require HTTP 200, `ok=true`, `cleared=true`, and `authority=elementor_files_manager`.
7. Fetch `https://projectorenclosure.com/homeline-projector-enclosure/`; require HTTP 200, self-canonical, index/follow, and all expected public content.
8. Fetch `https://projectorenclosure.com/wp-content/uploads/elementor/css/post-11852.css`; require HTTP 200 and non-empty CSS. Its hash may change after valid regeneration.
9. Re-read pages 11852 and 10513 and require exact baseline `_elementor_data` and `post_content` hashes.
10. Require unchanged title, slug, status, parent, media, Yoast, canonical, and robots fields on both pages.
11. Authenticated redirect GET for `/homeline-projector-enclosure-info/` must remain `exists=false`.
12. Public legacy URL must retain its pre-certification direct HTTP behavior.

Certification must not write Elementor data or post content, edit either page, create a redirect, upload media, change SEO, or publish content.

## Safety And Rollback

The endpoint has no content state to roll back. A successful call deletes only generated Elementor cache/CSS artifacts through Elementor's own files manager; frontend requests regenerate them from unchanged Elementor document data.

If certification fails:

1. Stop without page or redirect mutation.
2. Re-fetch the canonical page and generated CSS to allow normal regeneration.
3. Verify both Homeline page hashes and all identity/SEO/media fields remain unchanged.
4. Deactivate and delete **Genesis SSI Elementor Cache Authority v1** if the endpoint itself is faulty or no longer required.

The snippet stores no option, credential, post ID, path, cache name, or transaction state.
