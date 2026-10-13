# Published Contextual Media Authority Certification

The `PUBLISHED_CONTEXTUAL_MEDIA_UPDATE` authority is an internal Genesis operation for bounded contextual-media changes on exact published ProjectorEnclosure pages. It does not change the existing draft-only media writers.

## Certification Target

Do not use page 12932 for initial certification. Create a synthetic ProjectorEnclosure page whose only purpose is certification, publish it manually or through an approved draft/publish workflow, and record its exact ID, slug, canonical, content hash, and featured-media ID.

The synthetic page must contain unique exact anchors for:

- One contextual hero figure.
- One product-authority image region.
- One disposable acceptance marker.

Use synthetic generated media that is visually obvious and contains no customer, product, or installation claim.

## Transaction

1. Confirm the target site is `site-ssi-projectorenclosure` and the page is published.
2. Persist the exact page snapshot: content, SHA-256, title, slug, status, parent, featured media, canonical, robots, and public HTML.
3. Confirm no active evidence record exists for the same site/page.
4. Generate a small synthetic image through the approved image provider.
5. Record provider, generation job ID, prompt, timestamp, target site/page, role `contextual_application_media`, alt text, and byte hash.
6. Call `POST /api/sites/site-ssi-projectorenclosure/published-contextual-media` with:
   - `operation: PUBLISHED_CONTEXTUAL_MEDIA_UPDATE`
   - exact page ID, slug, canonical, content hash, and featured media
   - `featuredMediaPolicy: PRESERVE`
   - `media.type: GENERATED_CONTEXTUAL`
   - base64 image bytes and exact provenance
   - unique exact-anchor replacements
   - required and prohibited public acceptance markers
7. Require a committed evidence record, new contextual media ID/URL, exact readback hash, unchanged featured media, and public HTTP 200 containing the media URL and alt text.
8. Confirm title, slug, status, parent, canonical, robots, and unrelated HTML are unchanged.
9. Confirm the legacy generated-media and existing-media writers still return `published_target` for the same published page.

## Rollback Certification

Run a second synthetic transaction whose public acceptance deliberately fails.

1. Require page content restoration before any media cleanup request.
2. Require exact original content hash and featured-media ID after restoration.
3. Scan every simple REST-visible content collection for the generated media ID and exact URL attributes. For content types that reject REST edit-context enumeration, use authenticated read-only `wp.getPosts` XML-RPC fallback. Any fault, truncation, or inaccessible collection makes the scan incomplete and blocks deletion.
4. Delete the generated media only when the scan returns zero references, it is not featured media, and it was uploaded by this transaction.
5. Require the evidence state `ROLLED_BACK` and `generatedMediaDeleted=true`.
6. Repeat with a simulated or approved retained reference; require `ORPHAN_CLEANUP_REQUIRED` and no deletion.
7. Repeat with existing contextual media; require page rollback and prove the existing media is never deleted.

## Cleanup

After certification, delete the synthetic page and any remaining synthetic media through an explicitly approved cleanup operation. Verify their public URLs return normal absence, then retain the transaction evidence. Do not alter page 12932, media 11972, Homeline, holiday pages, commercial mapping pages, or redirects during first certification.
