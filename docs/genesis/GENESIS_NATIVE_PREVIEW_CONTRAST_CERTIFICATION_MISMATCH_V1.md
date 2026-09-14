# Genesis Native Preview Contrast Certification Mismatch V1

## Owner Failure And Freeze

- WordPress object: `13103`
- Status: `draft`
- Stored POST_CONTENT hash: `3d0a848aae7128153381defb7334addb1f5324deba7ab3a17ba6683f9e9b36e2`
- Owner-review readiness: false
- Publication readiness: false
- Publication, generation, media, workflow, and dispatch mutations: none

The owner's authenticated native WordPress preview reports dark Product Context and Application Experience headings over dark surfaces. This contradicts the prior lower-authority certificate, which reported both headings as white.

## Proven Certification Root Cause

The prior route was misclassified as `HOST_RENDER`. It is a synthetic host-equivalent reconstruction:

1. It fetches the public canonical product page, not the draft preview request for object `13103`.
2. It keeps that unrelated request's head resources and much of its body-class context.
3. It removes content between the public shell header/footer.
4. It manually inserts authenticated REST `content.rendered` for draft `13103`.
5. It manually appends `page-id-13103` and template classes.
6. It has no WordPress preview nonce, preview query, authenticated frontend cookies, admin bar state, or preview-conditional theme/plugin enqueue lifecycle.

Therefore it cannot establish the actual native preview cascade. The synthetic PASS is retained as `HOST_EQUIVALENT_RENDER` evidence and cannot override actual native evidence.

## Prior Equivalent Cascade Evidence

The host-equivalent capture computed both disputed H2 elements as white. Its winning readable declaration was the inline shared contract rule `h2 { color: var(--genesis-heading-color) !important }` from the reconstructed POST_CONTENT style block. Cross-origin theme/plugin stylesheets were listed but their CSS rules were unreadable to CSSOM under browser origin policy.

## Native Cascade Evidence Gap

The actual authenticated preview tab is not available to the automation context; the shared WordPress tab resolves to the login page. Therefore the actual native foreground RGB, winning selector, stylesheet URL, specificity, and `!important` state cannot be truthfully reported yet. This is recorded as `UNAVAILABLE_UNTIL_AUTHENTICATED_PREVIEW_IS_SHARED`, and no cascade repair is authorized.

## Pipeline Repair

- Contract: `NATIVE_HOST_RENDER_AUTHORITY_V1`
- Authority order: actual native host, host equivalent, Genesis composition, static CSS expectation
- Legacy `HOST_RENDER` is migrated to host-equivalent authority
- Owner contradiction blocks lower-authority readiness
- Style settlement waits for DOM, stylesheets, fonts, images, and three stable double-animation-frame samples
- Unstable styles fail closed
- Every text observation records DOM identity, matched color declarations, inferred winning declaration, source, specificity, order, and importance
- Every viewport persists screenshot bytes and computed-style evidence from the same browser instance under a correlation ID

## Required Continuation

The owner must authenticate in WordPress directly and share the actual preview tab. Genesis must then capture the two disputed H2 elements at 1440, 1024, 768, and 375, persist their actual native computed color and winning rules, and only then determine whether a reusable cascade repair is necessary.