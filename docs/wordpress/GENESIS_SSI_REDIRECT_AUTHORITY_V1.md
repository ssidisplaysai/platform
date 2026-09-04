# Genesis SSI Redirect Authority v1

Install the snippet from `wordpress-snippets/genesis-ssi-redirect-authority-v1.php` on `projectorenclosure.com` with Code Snippets.

## Installation

1. Sign in to WordPress Admin.
2. Open **Snippets > Add New** (or **Code Snippets > Add New**).
3. Choose **Add Your Custom Code (New Snippet)** when prompted.
4. Set the title to **Genesis SSI Redirect Authority v1**.
5. Choose **PHP Snippet**.
6. Paste the artifact contents without adding `<?php`.
7. Under scope/location, select **Run snippet everywhere**.
8. Save with **Save Changes and Activate**.
9. Confirm `/wp-json/` lists `/ssi/v1/redirect` with GET, POST, and DELETE.

The Genesis application-password user must have `edit_others_pages`. No credentials belong in the snippet.

## REST Contract

- `GET /wp-json/ssi/v1/redirect?source=/exact-source/`
- `POST /wp-json/ssi/v1/redirect` with JSON `{ "source": "/exact-source/", "destination": "/exact-destination/", "status": 301 }`
- `DELETE /wp-json/ssi/v1/redirect` with JSON `{ "id": "genesis-redirect-...", "source": "/exact-source/", "destination": "/exact-destination/" }`

Conflicting replacement additionally requires `expected_current_id` and `expected_current_destination` in POST. Initial certification must not use replacement.

## Certification

Use `/genesis-redirect-authority-certification-<unique-token>/` and destination `/homeline-projector-enclosure/`.

1. Verify the source returns 404 and does not resolve as WordPress content.
2. Authenticated GET must return `ok=true`, `exists=false`.
3. Anonymous POST must return 401.
4. Authenticated POST must return 201, `created=true`, status 301.
5. Authenticated GET must return the same id/source/destination/status.
6. Public source request without following redirects must return exactly 301 and exact same-site Location.
7. Following redirects must take one hop and finish at destination HTTP 200.
8. Repeat POST; require `idempotent=true`, `created=false`, `updated=false`, and the same id.
9. POST the same source with another destination and no expected-current identity; require 409.
10. Authenticated DELETE using exact id/source/destination; require `deleted=true`.
11. GET must return `exists=false`.
12. Repeat DELETE; require `deleted=false`, `exists=false`.
13. Public source request must no longer redirect and should return its normal 404.
14. Verify the destination, Homeline pages 11852/10513, media, content hashes, Yoast values, and unrelated routes are unchanged.

If any step after creation fails, execute the exact DELETE immediately and verify both authenticated absence and public removal before stopping.