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

## Proven Native Cascade Divergence

The owner shared the authenticated preview tab. In the actual page (`logged-in`, `admin-bar`, `page-id-13103`) both headings are now white after repair. A reversible browser-only reproduction removed exactly the six shared contrast rules, measured the native cascade, and restored them without changing WordPress:

- Before, both H2 elements computed to `rgb(25,25,25)`.
- The winning declaration was Cerato `h2 { color: rgb(25,25,25) }` from `zoo-custom-style.css?ver=7.1`, specificity `0,0,0,1`, not important.
- Product Context contrast was 1.06:1 on `rgb(23,32,34)`.
- Application contrast was 1.03:1 on effective `rgb(24,29,30)`.
- After restoring the shared rules, the winning declaration was `h2 { color: var(--genesis-heading-color) !important }` from the inline governed composition style block.
- Both headings computed to white; Product Context passed at 16.59:1 and Application passed at 17.03:1.

The systemic cascade repair is the existing site-neutral background-luminance contract, not a page- or heading-specific selector.

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

Actual authenticated native captures now cover 1440, 1024, 768, and 375. Each viewport records 9 failures before the shared rules and 0 after, stable style samples, paired screenshot hashes, and a screenshot/style correlation ID. Owner review may resume. Publication remains separately unauthorized.