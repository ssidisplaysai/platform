# Commercial Stainless Rich Composition Host Spacing Repair V1

## Scope

This bounded repair extends existing Code Snippets object 6. It does not publish or change page content, autosaves, featured media, templates, cache state, Wave 2, or Wave 3.

Authorities:

- Latest canary evidence: `46a85ab0cbf4b519fe0be50565b6ab8bbba9d7ff`
- Featured-image render repair: `222dd49cfe790cdd50fe097d8b8e7f2a9d868fd0`
- Publication verifier: `32c2d638d1a0e2e9d35d94bdb426fed9e9725808`
- Visual forensic: `6ab942ef59dbbb6a2ec15bf533f4a6033374ad4d`

## Proven spacing authority

The operative `twentytwentyfive//page` template contains a nested `core/group` whose direct children are `core/post-featured-image`, `core/post-title`, and `core/post-content`. Its rendered wrapper is:

```html
<div class="wp-block-group alignfull has-global-padding is-layout-constrained wp-block-group-is-layout-constrained"
     style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">
```

After the featured-image child was suppressed, the wrapper retained `padding-top:var(--wp--preset--spacing--60)`. The preset resolves to 70px at 1440 and 1024, 53.76px at 768, and 30px at 375. Those values exactly equal the residual V2 displacement in hero top, H1 top, and CTA bottom.

The global header and outer `<main>` margin are identical in staged and native documents. `wp-block-post-content`, `.wr-page`, and `.wr-hero` have zero leading margin/padding. The nested group top padding is therefore the first and sole residual divergence.

## Repair authority

The existing `render_block` filter at priority 20 now removes only the target group’s inline `padding-top` declaration when all conditions hold:

1. Normalized CSC host.
2. Published page request.
3. Parsed `core/html` post-content block containing exact `wr-page` and `wr-hero` class tokens.
4. Current block is `core/group`.
5. Group alignment is `full`.
6. Declared top padding is exactly `var:preset|spacing|60`.
7. Direct child block names include both `core/post-featured-image` and `core/post-content`.

The filter preserves the group, bottom padding, classes, child blocks, global header/footer, post content, featured-media assignment, and default template. No object-ID list grants rich-composition eligibility.

## Native-equivalent geometry proof

Applying the exact filter transformation to the retained V2 native document returned:

| Viewport | Hero top | H1 top | CTA bottom | Overflow |
|---:|---:|---:|---:|---:|
| 1440 | 179.39px | 323.79px | 696.69px | 0 |
| 1024 | 159px | 349.95px | 629.73px | 0 |
| 768 | 142.76px | 318.41px | 578.80px | 0 |
| 375 | 119px | 273.60px | 573.19px | 0 |

These match the approved staged geometry within sub-pixel tolerance. Production logic does not contain these pixel values.

## Eligibility and negative regression

Exact autosaves 88, 89, 90, 91, and 92 each retain featured media, contain embedded media, and resolve eligible after exact promotion. Current future-wave objects 12, 15, 16, and 18-22 remain ineligible until a separately approved composition supplies the structural markers.

Fixtures prove spacing remains unchanged for ordinary CSC content, wrong group alignment, wrong spacing preset, unrelated groups, Homepage, current Design-Build, legacy content, draft content, and non-CSC hosts.

## Deployment and safety

Snippet 6 was updated in place, remained active/global, and matches the exact source artifact. Current public pages are not rich-composition eligible, so their public body hashes did not change. Page 24 remains restored at `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`; autosave 88 remains `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499`; featured media remains 70.

The publication verifier and retain-or-rollback transaction were not changed or weakened.
