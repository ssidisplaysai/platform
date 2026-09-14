# Commercial Stainless Rich Page Host Spacing and Contrast Repair V1

## Scope

Authorized scope was host-presentation repair only. No WordPress page content, media, SEO, canonical, featured-media, or publication write was performed. Wave 2 did not continue.

## Root cause

Actual DOM and CSS inspection identified the exact gap authority:

- Element: `main#wp--skip-link--target.wp-block-group.has-global-padding.is-layout-constrained`
- Owning style: inline block-template style
- Property: `margin-top: var(--wp--preset--spacing--60)`
- Computed values: 70px at 1440 and 1024, 53.7578125px at 768, and 30px at 375
- Source: Twenty Twenty-Five rendered template main wrapper

The existing host repair removed padding from a containing group but did not neutralize this separate main margin.

Both contrast failures were caused by the composition rule `.wr-eyebrow { color: var(--red) }`, resolving to `rgb(201,31,43)`:

- Hero eyebrow `p.wr-eyebrow`: dark governed image-overlay background, 2.77:1 before repair
- Final CTA eyebrow `p.wr-eyebrow`: red `rgb(201,31,43)` background, 1:1 before repair

## Durable bounded repair

Snippet 6 now enqueues a frontend stylesheet only when the existing Commercial Stainless rich-page predicate passes. The predicate requires the exact host, a published page, and an approved marker family (`wr-page + wr-hero`, or configured static-front-page `gvc-page + gvc-hero`).

Durable rules:

```css
main#wp--skip-link--target { margin-top: 0 !important; }
.wr-hero .wr-eyebrow,
.wr-cta .wr-eyebrow {
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
}
```

The main margin is neutralized directly. White is applied only in the semantic dark/image hero and red final-CTA contexts. Light-section eyebrows retain governed red. No negative margins, browser injection, or object-specific selector is used.

## Object 12 certification

Object 12 remained at exact stored hash `b2e2f2b690e3d518472bd56e08886701293314d2215838b37d7a3c7fdbf4ddc3` before and after repair. Public URL: `https://commercialstainlesscounters.com/commercial-stainless-counters/`.

Actual public host results at 1440, 1024, 768, and 375:

- Header-to-hero gap: 0px
- Main computed margin-top: 0px
- Hero eyebrow: white, 15.65:1
- Final CTA eyebrow: white, 5.65:1
- Dark-on-dark failures: 0
- Light-on-light failures: 0
- Unreadable text failures: 0
- Horizontal overflow: 0
- Global header/footer: 1 each
- Theme title visible: 0
- Genesis hero visible: 1
- Semantic H1: 1
- Overlap, fragmented headings, unusable CTAs, empty sections: 0
- Main-content images: 5
- Unique main-content images: 5
- Broken media: 0
- Broken internal links: 0 of 6
- Development links: 0

Two fresh public reads returned HTTP 200, complete HTML, passed structural predicates, and converged on render hash `f94c7c926ff1b12031ca4f20063ffecbd4ace4f7e623cea4801ce6c1e31f4ce4`.

Durable certification ID: `csc-rich-host-repair-v1-object12-20260914`.

## Remaining Wave 2 preflight

Objects 15, 16, 18, and 19 were not published or certified by this operation. Read-only public/host inspection found each currently satisfies the rich eligibility markers and receives both durable repair rules. The previously proven systemic spacing and eyebrow risks are therefore eliminated at the host-authority layer, subject to separate publication/certification authorization.

## Safety and preservation

Design-Build remains outside eligibility: its theme title and original main spacing remain present, and no mutation occurred. Homepage object 10 retained hash `a6bbe8f0db6080c2732cb4baec7bba5d361ebacfc40a16815c655cef8f0e4508`; all four homepage viewport checks retained zero title, one hero, one H1, zero gap, and zero overflow. Wave 1 remains 5/5 public-certified. Wave 2 continuation, Wave 3, Agent 1, ProjectorEnclosure, production 3001, port 3002, and the certified tag were untouched.
