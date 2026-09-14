# Commercial Stainless Page 24 Publication Failure Forensic V1

## Scope

This investigation is read-only. It did not publish or mutate any WordPress object, autosave, revision, campaign, Wave 2 page, or Wave 3 page. It analyzes the rolled-back Page 24 attempt recorded by commit `5ad4a3cdf668a9862ab553a557cec1c1f4bfe427`.

## Hash chain

| Stage | SHA-256 | Evidence |
|---|---|---|
| Owner-approved WordPress composition | `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499` | Certified staging record |
| Autosave 88 raw content | `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499` | Authenticated autosave GET |
| Autosave 88 rendered content | `fb5c45388ea28eda5eb985314747d273183b79c683c5a2da1b9a0b7466e48115` | Authenticated autosave GET |
| Publication request `content` value | `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499` | Committed publisher path and current autosave |
| Stored promoted revision 93 raw content | `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499` | Authenticated revisions GET; timestamp `2026-09-14T03:06:39Z` |
| Stored promoted revision 93 rendered content | `fb5c45388ea28eda5eb985314747d273183b79c683c5a2da1b9a0b7466e48115` | Authenticated revisions GET |
| Failed public HTTP render | Unavailable | The failed HTML/hash was not persisted before rollback |
| Rolled-back stored content, revision 94 | `3829c2a5e5c322552dba1c4217ca4ea41236606b98ea1ff6a3e598ba182e3b41` | Authenticated revisions GET; timestamp `2026-09-14T03:06:46Z` |
| Restored public `<main>` | `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734` | Three independent cache-bypassed HTTP reads |

The first divergence was not content promotion. Autosave 88, request payload, and promoted revision 93 are byte-identical. The first deterministic divergence was verifier interpretation after the write.

## Exact failed assertions

The receipt retained only aggregate labels, not the failed response or predicate matrix. Two failing predicates can nevertheless be proven from the committed verifier and exact promoted revision:

1. `sha256(shellHtml(afterPublic.html)) === before.shellHash` failed by construction. `shellHtml()` selected the first `<footer>` anywhere in the document. The pre-publication legacy body contained its own footer before the global footer; the promoted body did not. The function therefore compared the legacy body footer before publication with the global template-part footer after publication and mislabeled the intended body-shell removal as `IDENTITY_DRIFT`.
2. `legacyGiantWhitespace === false` failed by construction. The detector treated any `min-height` from 500px upward as giant whitespace. Autosave 88 intentionally contains the approved hero rule `.wr-hero{min-height:610px}`, so the valid hero triggered `SEMANTIC_FAILURE`.

Revision 93 independently proves the remaining body-level assertions: H1 count 1, body navigation count 0, `wr-page`, `wr-hero`, and `wr-related` present, `gvs-page` absent, five approved media references present, and rendered hash identical to autosave 88. All five media URLs currently return HTTP 200.

The exact failed HTTP response was discarded, so its full-document hash and contemporaneous values for HTTP status, header count, footer presence, broken links, and cache state are not recoverable. They must not be represented as measured historical values.

## Authority map

- Staged authority: native `wp_posts` autosave/revision 88, read through `/wp/v2/pages/24/autosaves/88`, using WordPress `content.raw` and `content.rendered`.
- Promotion authority: Genesis read autosave 88 `content.raw`, trimmed outer whitespace, and sent it as the sole `content` field to `POST /wp/v2/pages/24`.
- Stored published authority: Page 24 `wp_posts.post_content`. Revision 93 proves exact storage of the request value.
- Public render authority: WordPress block rendering of Page 24 `post_content` inside the Twenty Twenty-Five default page template, plus the active site-scoped `render_block` filter that suppresses the theme `core/post-title` block.
- Template authority: default page template with global `wp-block-template-part` header and footer.
- Media authority: featured media 70 remained separate and unchanged; body media are five explicit URLs in the HTML block.
- Elementor authority: none detected in content or REST-visible meta.
- Reusable block authority: no `wp:block` references in autosave 88.

`POST_CONTENT_BLOCK_HTML` remains the operative Page 24 content authority.

## Promotion path

The implementation did not invoke a native “promote revision 88” endpoint. It performed a content-only REST update using the raw body read from autosave 88. It omitted status, slug, title, excerpt, featured media, meta, and template. It did not reconstruct blocks or serialize a parsed block tree. The only client transformation was outer whitespace trimming. WordPress created revision 93 with exact raw and rendered hashes, proving no promotion-time content transformation.

Therefore:

- Exact revision endpoint promotion: false.
- Exact autosave content identity: true.
- Content reconstruction: false.
- WordPress transformation: false.

## Staging/public equivalence

The staged body came from native WordPress autosave `content.rendered`. Genesis then inserted that rendered fragment into a custom document assembled from the current public header, `<main>` attributes, and footer. It was not a native WordPress autosave preview URL and did not execute the complete public template/render request as a single WordPress operation.

The body rendering authority was native WordPress, but full-page staging and public rendering were not equivalent. The custom staging composition also bypassed the faulty publication verifier predicates, so certification could pass while publication verification failed.

## Cache assessment

The failed response was not persisted, and the server returned no `Age`, `Cache-Control`, `CF-Cache-Status`, `X-Cache`, or `X-Cache-Status` headers in three current reads. Those reads were stable, Apache-served, and matched the restored hash. Cache staleness at the incident timestamp is therefore unproven. It is unnecessary to explain the failure because both aggregate labels have deterministic verifier false positives.

## Blast radius

The defect is systemic to the Wave 1 publication verifier:

- All approved profiles use hero `min-height` values at or above 500px, so all can trigger the whitespace false positive.
- Any legacy page with an embedded body footer can trigger the shell hash false positive when the approved composition removes that duplicate footer.
- Pages 11, 13, 17, and 23 were not mutated, but the same verifier would place them at risk.
- Other Genesis `POST_CONTENT_BLOCK_HTML` sites are affected only if they reuse this publication verifier or equivalent regexes; the defect is not in WordPress content authority itself.

## Smallest repair gate

1. Preserve the content-only compare-and-set publication path, because revision 93 proves exact stored identity.
2. Replace generic first-header/first-footer extraction with the existing exact `wp-block-template-part` shell extractor and select the final global footer.
3. Replace CSS-text `min-height` matching with measured rendered-layout checks: header-to-hero gap, empty vertical regions, section bounds, and viewport screenshots.
4. Persist the post-write authenticated page snapshot, every identity predicate, every semantic predicate, public response headers, and failed public HTML hash before deciding rollback.
5. Require repeated cache-bypassed reads to agree on the promoted marker/hash before semantic certification; classify disagreement as propagation uncertainty rather than content failure.
6. Prove the repaired verifier offline against revision 93 and a legacy-body fixture, then use a separately authorized disposable or Page 24 canary gate before another publication attempt.

Required tests: exact autosave identity, request payload identity, revision/stored content identity, exact template-part shell identity, allowed hero-height behavior, public semantic identity, staging/public template equivalence, failed-response evidence persistence, cache-aware repeated-read convergence, and exact rollback identity.