# GLW Fresh Site Onboarding

Use **Sites > Add New Site** to connect a greenfield WordPress installation without editing Genesis registry files.

## Prerequisites

- A public domain with valid SSL
- WordPress installed with `/wp-admin` and the REST API available
- A dedicated WordPress username and Application Password
- An existing Genesis organization

Genesis rejects non-HTTPS, credential-bearing, localhost, private-address, link-local, custom-port, and cross-domain redirect targets. Public preflight is read-only and must pass before a site shell can be created.

## Operator Flow

1. Select **Fresh WordPress Site**, enter the site name, domain, and organization, then run public preflight.
2. Create the safe site shell. It starts `draft`, disabled, `draft_only`, and unavailable for production generation.
3. Enter the WordPress username and Application Password directly in GLW. The password is masked, encrypted by the existing Genesis credential store, cleared from browser state after storage, and never returned by the API.
4. Run the authenticated read-only connection test. Genesis reads identity, pages, posts, media, post types, categories, and tags without writing WordPress content.
5. Select active organization profiles for SEO, prompt, image, brand, and workflow. Keep `draft_only` unless an authorized publishing policy is intentionally selected.
6. Review canonical readiness and the integration assessment. Empty content and zero products are valid for a fresh site.

## Completion And Handoffs

`SITE_READY_FOR_PRODUCT_ONBOARDING` means WordPress is connected, the required Genesis profiles are configured, and product authority can be added. It does not mean campaign publication is enabled.

The completion view offers product-by-URL and manual/source-based handoffs. Manual onboarding can later use owner documents, factory specifications, images, first-party data, and approved sources. Campaign Launchpad remains a separate reach-first workflow and is unavailable until a product is ready. Fresh-site onboarding never creates campaigns, reserves targets, publishes content, or enables direct publication.

## Integration Assessment

The assessment considers REST reachability, authenticated reads, content and media volume, canonical consistency, page-builder requirements, and profile state. Greenfield WordPress fixtures normally classify as `LOW`. Existing-site integrate-versus-rebuild analysis is a future extension and is explicitly not certified in V1.