# Commercial Stainless Rich Composition Featured Image Render Repair V1

## Scope

This bounded repair updates existing Code Snippets object 6, `Genesis CSC Post Launch Defect Repair V1`, in place. It does not rewrite the Twenty Twenty-Five page template, publish a page, change `post_content`, modify autosaves, alter featured-media assignments, or begin Wave 2 or Wave 3.

Visual forensic authority: `6ab942ef59dbbb6a2ec15bf533f4a6033374ad4d`. Publication verifier authority: `32c2d638d1a0e2e9d35d94bdb426fed9e9725808`.

## Render authority

Implementation authority is WordPress `render_block` at priority 20 in the existing site-scoped post-launch snippet. The filter returns an empty string only for `core/post-featured-image` when the queried page satisfies the rich-composition eligibility contract. The default `twentytwentyfive//page` template and its block order remain unchanged.

The eligibility predicate requires:

1. Normalized `home_url()` host equals `commercialstainlesscounters.com`.
2. Queried object post type is `page`.
3. Queried object status is `publish`.
4. Raw `post_content` parses through WordPress `parse_blocks()`.
5. A `core/html` block, including a recursively nested one, contains structural class tokens `wr-page` and `wr-hero`, detected by `WP_HTML_Tag_Processor`.

Object number alone never grants eligibility. Presentation text containing the strings `wr-page` or `wr-hero` does not qualify.

## Render-only behavior

The filter changes only the rendered output of the template-level featured-image block. It does not call `wp_update_post`, `update_post_meta`, media APIs, or any attachment API. It leaves these authorities intact:

- Page `featured_media` and `_thumbnail_id`.
- Attachment metadata.
- Yoast/social image authority.
- Rich-composition `post_content` and embedded hero image.
- Header, footer, post content, URL, slug, canonical, indexability, and SEO fields.

Page 24 featured media remained ID 70 before and after deployment. Autosave 88 remained hash `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499`.

## Offline native-stack proof

The fixture models the operative template stack:

1. Global header.
2. Theme `core/post-featured-image`.
3. `core/post-content` containing `.wr-page` and `.wr-hero`.
4. Global footer.

For eligible content, the filter removes only item 2. Header, post content, embedded rich hero media, and footer remain. The image source occurs once instead of twice.

Removing the measured theme featured stack returns Page 24 to the approved envelope:

| Viewport | Displacement removed | Hero top | H1 top | CTA bottom |
|---:|---:|---:|---:|---:|
| 1440 | 570px | 179.39px | 323.79px | 696.69px |
| 1024 | 570px | 159px | 349.95px | 629.73px |
| 768 | 537.52px | 142.76px | 318.41px | 578.80px |
| 375 | 260px | 119px | 273.60px | 573.19px |

These values are certification evidence, not production branching constants.

## Eligibility regression

Read-only authenticated evaluation of preserved WordPress authorities returned:

| Object | Autosave | Featured media | Theme would render | Rich composition owns media | Eligible after exact promotion |
|---:|---:|---:|---|---|---|
| 24 | 88 | 70 | Yes | Yes | Yes |
| 11 | 89 | 44 | Yes | Yes | Yes |
| 13 | 90 | 48 | Yes | Yes | Yes |
| 17 | 91 | 56 | Yes | Yes | Yes |
| 23 | 92 | 68 | Yes | Yes | Yes |

Future current pages 12, 15, 16, and 18-22 all retain featured media but are currently ineligible because their published content does not contain the approved structural authority. They become eligible only after a separately approved rich composition with both markers is promoted.

Negative fixtures preserve normal featured rendering for ordinary pages with or without featured media, unrelated marker-like text, legacy Commercial Stainless content, Homepage, current Design-Build, non-Commercial-Stainless hosts, and draft rich content.

## Deployment and current safety

Snippet 6 was updated in place, remained active and global, and matched the exact artifact after write. Current public pages are legacy/restored and therefore ineligible; their public body hashes remained unchanged. Page 24 remained restored at `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`.

Homepage, Design-Build, objects 11, 13, 17, 23, featured-media assignments, autosave 88, and all 15 published objects were preserved. The publication verifier and retain-or-rollback implementation were not changed.
