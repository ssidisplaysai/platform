# Commercial Stainless Page 24 Canary Publication Retry V2

## Authorization and scope

The owner authorized only WordPress object 24, `/request-a-quote/`, autosave 88, under `COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLICATION_RETRY_V2:APPROVED`. Objects 11, 13, 17, and 23, Wave 2, and Wave 3 were not authorized.

Authority chain:

- Visual forensic: `6ab942ef59dbbb6a2ec15bf533f4a6033374ad4d`
- Publication verifier: `32c2d638d1a0e2e9d35d94bdb426fed9e9725808`
- Featured-image render repair: `222dd49cfe790cdd50fe097d8b8e7f2a9d868fd0`
- Previous canary evidence: `f08259db40fdb38d4d6dd75525b11ae04f277c6b`

## Exact promotion and converged public semantics

Receipt: `csc-page24-canary-publication-retry-v2-24-88`.

- Pre-publication public-main hash: `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`.
- Autosave 88, publication payload, and stored `post_content`: `080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499`.
- Converged public render hash: `e78c0717033f41e7e0f12050e8b52176e57c05ee32c10b40c0aa36d6c6f72fa7`.
- Two consecutive reads returned HTTP 200, the same render hash, and `FRESH_EXPECTED`; aggregate state was `CONVERGED_EXPECTED`.
- Structural and semantic checks passed: one global header/footer, zero body navigation/header, one H1, rich identity present, zero legacy composition, zero broken media/links/development links/unsupported claims.
- Actual public render contained zero `wp-block-post-featured-image` blocks, five rich-composition images, and zero duplicate image sources.
- Featured media remained ID 70.

## Actual responsive geometry

All four actual public renders had zero horizontal overflow, resolved media, continuous section ordering, no overlap, correct global shell, H1 above fold, and primary CTA above fold.

| Viewport | Actual hero top | Approved hero top | Delta | Actual H1 top | Approved H1 top | Actual CTA bottom | Approved CTA bottom |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1440x900 | 249.39px | 179.39px | +70px | 393.79px | 323.79px | 766.69px | 696.69px |
| 1024x900 | 229px | 159px | +70px | 419.95px | 349.95px | 699.73px | 629.73px |
| 768x900 | 196.52px | 142.76px | +53.76px | 372.16px | 318.41px | 632.55px | 578.80px |
| 375x812 | 149px | 119px | +30px | 303.60px | 273.60px | 603.19px | 573.19px |

The featured-image render repair removed the image and its bottom margin, but the containing Twenty Twenty-Five group retained its responsive top padding. That padding is exactly the residual delta at every viewport. It is deterministic and exceeds floating-point/rendering tolerance, so the public geometry did not equal the approved envelope.

## Decision and rollback

Visual certification `csc-page24-public-canary-v2-20260914T0421Z` failed the approved geometry gate. Evidence was persisted before rollback. Genesis restored exact prior `post_content` and verified the public-main hash returned to `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734` with HTTP 200.

Final receipt state is `ROLLED_BACK`; Page 24 is not public-certified. Featured media remains 70 and autosave 88 remains unchanged. Objects 11, 13, 17, and 23 retained exact control hashes. The estate remains 15 objects.

## Next bounded repair

Do not retry automatically. The next repair should neutralize the otherwise-empty rich-page template group top padding only when the same positive rich-composition eligibility contract suppresses its featured-image child. It must preserve ordinary-page padding, the global header/footer, the default template source, featured-media authority, SEO, and post content.
