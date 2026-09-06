# Genesis SSI Public Page Cache Authority v1

This artifact is prepared for ProjectorEnclosure cache discovery and page-scoped invalidation. It is not installed or certified yet.

## Contract

- `GET /wp-json/ssi/v1/page-cache` reports front-page settings, external object-cache state, and supported page-scoped adapters.
- `POST /wp-json/ssi/v1/page-cache` accepts exactly `{ "action": "purge", "page_id": number, "url": "https://projectorenclosure.com/.../" }`.
- Authentication and `edit_others_pages` are required.
- The caller must also be able to edit the exact page.
- The URL must be HTTPS, same-site, free of credentials/query/fragment, and match the page permalink.
- Front-page targets require the root URL and receive both object-ID and root-URL invalidation when the detected adapter supports both.

The endpoint invokes only detected page/post-scoped adapters for WP Rocket, LiteSpeed Cache, or W3 Total Cache. It reports GoDaddy WPaaS and fixed WordPress cache drop-ins for discovery, but does not invoke an undocumented API. WordPress `clean_post_cache()` is always called but is not considered proof of public page-cache invalidation. If no supported page-cache adapter is present, the endpoint returns HTTP 503 with `state=UNAVAILABLE`.

The artifact never performs a global cache flush, accepts a filesystem path or cache key, mutates options, manages plugins, executes caller code, or changes page content.

## Required Certification

1. Install the PHP body with SSI Snippets on `projectorenclosure.com` only.
2. Require authenticated GET to identify the actual cache adapter and confirm `pageOnFront=3810`.
3. Repeat the disposable unlinked page marker test and require cleanup to 404.
4. Prove the detected page-scoped adapter changes stale public content to the authenticated updated marker.
5. Restore the original marker, purge again, and prove public rollback propagation.
6. For front-page readiness, use a separately authorized reversible marker on page 3810 or another configured disposable front page; prove both page-ID and root-URL invalidation.
7. Confirm an unrelated control page remains semantically unchanged.

Until these checks pass, public cache state is `UNAVAILABLE` and page 3810 remediation remains on hold.