# Commercial Stainless Page 24 Public Visual Geometry Forensic V1

## Scope and evidence

This investigation is read-only. It uses canary receipt `csc-page24-canary-publication-retry-v1-24-88`, visual certification `csc-page24-public-canary-20260914T0345Z`, the four retained public screenshots, the failed native public document still loaded in the browser, the exact WordPress staged iframe, authenticated WordPress template reads, and the restored public page.

No WordPress content, autosave, template, CSS, cache, campaign, Wave 2 object, or Wave 3 object was changed.

## Direct geometry comparison

All coordinates are document-relative CSS pixels.

| Measurement | Staged 1440x900 | Public 1440x900 | Staged 1024x900 | Public 1024x900 | Staged 768x900 | Public 768x900 | Staged 375x812 | Public 375x812 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Header top | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Header height / bottom | 109.39 | 109.39 | 89 | 89 | 89 | 89 | 89 | 89 |
| Main top | 179.39 | 179.39 | 159 | 159 | 142.76 | 142.76 | 119 | 119 |
| Main margin top | 70 | 70 | 70 | 70 | 53.76 | 53.76 | 30 | 30 |
| Theme featured image top | none | 249.39 | none | 229 | none | 196.52 | none | 149 |
| Theme featured image height | 0 | 430 | 0 | 430 | 0 | 430 | 0 | 200 |
| Theme featured image bottom | none | 679.39 | none | 659 | none | 626.52 | none | 349 |
| Native post-content top | 179.39 | 749.39 | 159 | 729 | 142.76 | 680.27 | 119 | 379 |
| Hero top | 179.39 | 749.39 | 159 | 729 | 142.76 | 680.27 | 119 | 379 |
| Hero height / bottom | 610 / 789.39 | 610 / 1359.39 | 610 / 769 | 610 / 1339 | 560 / 702.76 | 560 / 1240.27 | 600 / 719 | 600 / 979 |
| Hero media top / height | 179.39 / 610 | 749.39 / 610 | 159 / 610 | 729 / 610 | 142.76 / 560 | 680.27 / 560 | 119 / 600 | 379 / 600 |
| H1 top / height / bottom | 323.79 / 209.51 / 533.30 | 893.79 / 209.51 / 1103.30 | 349.95 / 116.39 / 466.34 | 919.95 / 116.39 / 1036.34 | 318.41 / 97 / 415.41 | 855.92 / 97 / 952.92 | 273.60 / 116.39 / 389.99 | 533.60 / 116.39 / 649.99 |
| Primary CTA top / height / bottom | 644.69 / 52 / 696.69 | 1214.69 / 52 / 1266.69 | 577.73 / 52 / 629.73 | 1147.73 / 52 / 1199.73 | 526.80 / 52 / 578.80 | 1064.31 / 52 / 1116.31 | 521.19 / 52 / 573.19 | 781.19 / 52 / 833.19 |
| First section after hero top | 789.39 | 1359.39 | 769 | 1339 | 702.76 | 1240.27 | 719 | 979 |

The global header and ordinary theme main offset are identical between staged and public documents. The first divergence is between `<main>` and `wp-block-post-content`.

## Native template authority

Authenticated read of `twentytwentyfive//page` returned theme source and raw template hash `5913d2b9f9745f508641358aa280bcf723f1934ac3bf9c42d3e3121e90050bab`.

The operative block sequence is:

1. `core/template-part` header.
2. `core/group`.
3. Nested `core/group`.
4. `core/post-featured-image`.
5. `core/post-title`.
6. `core/post-content`.
7. `core/template-part` footer.

The site-scoped `render_block` filter removes `core/post-title` for objects 10-24, so the title has zero rendered height. The public DOM confirms the featured-image figure and post-content wrapper are siblings inside one constrained full-width group.

At 1440 and 1024 the group contributes 70px top padding, the featured image is 645x430, and its bottom margin is 70px: `70 + 430 + 70 = 570px`. At 768 the contribution is `53.76 + 430 + 53.76 = 537.52px`. At 375 it is `30 + 200 + 30 = 260px`.

The post-content wrapper reports a computed `margin-top: 19.2px`, but it adds no independent measured displacement beyond the larger featured-image bottom margin. The approved `.wr-page` and hero begin exactly at the native post-content boundary; their leading whitespace is zero.

## Featured-image proof

Featured media ID 70 remains the WordPress featured-media authority. The theme renders `request-a-quote.jpg` in `figure.wp-block-post-featured-image` before post content. Autosave 88 independently renders the same URL as `.wr-hero > img`. The failed public DOM therefore contains the same source twice.

The theme featured-image stack is the complete measured difference between staged and public hero, H1, CTA, and following-section coordinates at every viewport. Suppressing only theme display of `core/post-featured-image` for an approved rich-composition page would restore the staged geometry while preserving featured media ID 70.

Featured-image classification: root cause, not partial.

## Responsive classification and design intent

- 1440: real failure caused by the 570px theme featured-image stack. Staged H1 and CTA are fully inside 900px; public H1 ends at 1103.30 and CTA at 1266.69.
- 1024: real failure caused by the same 570px stack. Staged H1/CTA fit; public H1 starts below the viewport and CTA ends at 1199.73.
- 768: real failure caused by the 537.52px responsive featured-image stack. Staged H1/CTA fit; public H1 and CTA do not.
- 375: real failure caused by the 260px responsive featured-image stack. Staged CTA ends at 573.19 inside the 812px viewport; public CTA ends at 833.19.

For this approved Page 24 design, requiring the entire primary CTA at 375 and H1 plus CTA at 768 is supported by the owner-approved staged geometry. It is not asserted as a universal rule for every future hero. The visual predicate was not a false positive for this canary.

## Smallest repair recommendation

Add a site-scoped render rule that suppresses only the theme-level `core/post-featured-image` block when all of these are true:

- The queried object is an explicitly approved Commercial Stainless rich-composition page.
- Operative authority is `POST_CONTENT_BLOCK_HTML`.
- Post content contains the approved `.wr-page` and `.wr-hero` identity.

Do not alter `_thumbnail_id`, featured media ID, media attachment records, autosave content, global template source, header, footer, SEO, URL, slug, canonical, or indexability. No composition or responsive hero change is required. The normal theme main offset remains 70px, 53.76px, or 30px and is already present in the approved staged reference.

A subsequent bounded canary must prove the theme featured-image block count is zero, featured media ID remains 70, public hero coordinates equal the approved staged coordinates, and all semantic/visual gates pass before retention.

## Blast radius

This is a Commercial Stainless theme-system interaction for rich compositions that include their own hero while the default `twentytwentyfive//page` template also renders featured media. Objects 11, 13, 17, and 23 use the same pattern and are expected to diverge similarly if promoted without suppression. Planned objects 12, 15, 16, and 18-22 have the same risk when they receive rich compositions and retain featured media.

It is not generally `POST_CONTENT_BLOCK_HTML` systemic: sites or templates without a pre-content `core/post-featured-image`, and compositions without duplicate hero media, do not share this geometry defect.

## Current safe state

Page 24 is restored at public-main hash `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`. Autosave 88 remains preserved at `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499`. Objects 11, 13, 17, and 23, Homepage, and Design-Build retain their control hashes. The published estate remains 15 objects.
