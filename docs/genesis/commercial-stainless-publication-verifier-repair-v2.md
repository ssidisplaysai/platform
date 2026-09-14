# Commercial Stainless Publication Verifier Repair V2

## Scope

This repair changes Genesis verification and certification behavior only. It does not publish or mutate WordPress, modify autosaves 88-92, install a plugin or preview endpoint, request a browser session, or begin Wave 2 or Wave 3.

Forensic authority: `052b269bbc4a64b512a9a2ec6358d90fa4cb0a20`.

## Accepted native-preview constraint

The site advertises autosave and revision data routes but no themed preview REST route. WordPress core full-page autosave preview requires a valid user-session-bound `preview_nonce`. Nonce-less preview requests return the restored public Page 24 body, and invalid nonces are rejected by core. Native preview installation is deferred by owner decision.

The certification vocabulary is therefore:

- `PREPUBLICATION_READY`: owner-approved Genesis composition equals exact WordPress autosave raw/rendered authority, with available SEO, canonical, indexability, media, links, structure, and responsive evidence passing.
- `PUBLIC_CERTIFIED`: reserved for a later authorized transaction after exact promotion, stored identity proof, converged native public WordPress rendering, semantic certification, and responsive visual certification.
- `NATIVE_WORDPRESS_PREVIEW_CERTIFIED`: never claimed by this implementation.

## Reusable verifier

`wordpress-post-content-publication-verifier.ts` is scoped to `POST_CONTENT_BLOCK_HTML` flows. It does not claim Elementor authority.

### Structural shell authority

The verifier parses HTML into a DOM and identifies global shell elements only when they are `header.wp-block-template-part` or `footer.wp-block-template-part` outside `<main>`. It separately counts navigation, headers, and footer-like artifacts inside post content.

This prevents a legacy body footer from satisfying or invalidating the global footer assertion. Fixtures cover a valid shell, a legacy body footer plus valid global footer, duplicate global header, body navigation, duplicate body header, missing global footer, wrong H1, and wrong page identity.

### Rendered whitespace authority

CSS declarations are not whitespace evidence. The verifier consumes viewport and bounding-rectangle evidence for sections, text, media, and CTAs. A visible region occupying at least half a viewport fails only when it has zero meaningful rendered elements and zero measured occupancy.

Browser measurement at 1440x900 proved:

- Populated hero: 1425x610, visible H1/copy/CTA, full media occupancy: pass.
- Empty control: 1425x610, no text/media/CTA occupancy: fail.
- A larger populated visual hero also passes; a 1000px blank spacer fails.

### Public read convergence and cache evidence

A future publication uses at most five reads within 10 seconds, requires two consecutive HTTP 200 responses with the same expected semantic body hash and predicate result, and uses 250ms bounded attempt spacing. Each attempt captures:

- Timestamp and URL.
- HTTP status.
- `Age`, `Cache-Control`, `ETag`, `Last-Modified`, `CF-Cache-Status`, `X-Cache`, `X-Cache-Status`, server, and date headers when emitted.
- Full response HTML internally and a response-body hash.
- Expected and actual stored content hashes.
- Semantic identity, complete predicate matrix, failed predicates, cache classification, and visual reference.

Classifications are `FRESH_EXPECTED`, `STALE_PRIOR`, `CONVERGED_EXPECTED`, and `INDETERMINATE`. A stale prior response remains eligible for bounded convergence and cannot trigger immediate rollback by itself.

### Durable retain-or-rollback transaction

The reusable offline transaction contract executes:

1. Capture rollback authority.
2. Verify approved autosave identity.
3. Verify promotion payload identity.
4. Promote exact content.
5. Verify stored post-content identity.
6. Require converged public semantic evidence.
7. Require responsive visual evidence.
8. Retain only when every gate passes.

On failure, it persists the failed gate and convergence evidence before rollback, restores exact prior authority, verifies rollback identity, and stops. Tests cover wrong autosave, payload mismatch, stored mismatch, non-converging stale content, semantic failure, responsive failure, and rollback mismatch.

The Commercial Stainless publisher now uses the structural shell verifier, convergence policy, cache headers, redacted durable response evidence, and persist-before-rollback ordering. Its API does not expose stored failed HTML.

## Page 24 forensic replay

Autosave 88, the original publication payload, and promoted revision 93 share raw hash `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499`. Revision 93 also shares autosave rendered hash `fb5c45388ea28eda5eb985314747d273183b79c683c5a2da1b9a0b7466e48115`.

The repaired structural verifier ignores the legacy footer inside pre-publication post content and identifies the final WordPress template-part footer. The rendered geometry verifier accepts the populated 610px hero. The two proven false-positive predicates would now pass.

The failed public response was not retained by the old implementation. This replay therefore proves correction of the known false positives but does not retroactively claim full public certification.

## Wave 1 read-only prepublication recheck

All five autosaves returned `PREPUBLICATION_READY`:

| Object | Autosave | Content | Render | SEO/canonical/indexability | Media/links | Structure/responsive |
|---:|---:|---|---|---|---|---|
| 24 | 88 | Pass | Pass | Pass | Pass | Pass |
| 11 | 89 | Pass | Pass | Pass | Pass | Pass |
| 13 | 90 | Pass | Pass | Pass | Pass | Pass |
| 17 | 91 | Pass | Pass | Pass | Pass | Pass |
| 23 | 92 | Pass | Pass | Pass | Pass | Pass |

No native preview or public certification is claimed.

## Current public safety

Page 24 remains restored at public-main hash `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`. Pages 11, 13, 17, and 23 match their pre-attempt hashes. Homepage and Design-Build remain unchanged. The published estate remains exactly 15 objects, IDs 10-24.
