# Commercial Stainless Page 23 Semantic Media Owner Review V1

## Scope and safety

This is a read-only review of WordPress object 23, `/about/`, autosave 92, profile `RESOURCE`, under semantic media policy `af3c49051cd655f2f7fb212f2c42916e41387b63`.

- Autosave 92 remains `PUBLICATION_READY` at content hash `f12ea05f629d60988a31969b138b472caffde88833557422cf5766a388602dc0` and rendered hash `f9a0548798c8dc98fa8030366f179f02774f2f3c2a82d1123e3f40bdc31f6123`.
- The public About page remains unchanged at hash `cb550e5dc345de132fd9b03636517ec430fd01a916052cec7a1994283f7f3308`.
- No WordPress content, publication state, or autosave was mutated.

Owner review route:

`http://localhost:3013/sites/site-rj-metal-commercial-stainless-counters/build/rich-composition-wave-1-wordpress?organizationId=rj-metal&siteId=site-rj-metal-commercial-stainless-counters`

## Media inventory

All geometry below is from the approved staged render at 1440 px. Every instance is `POST_CONTENT_BLOCK_HTML`, `GOVERNED_COMPOSITION`, and conceptual/generated rather than documentary.

| # | Media source / attachment URL | Section identity | Semantic / composition role | Rendered geometry | Reuse count |
|---:|---|---|---|---|---:|
| 1 | `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/about.jpg` | `wr-hero.wr-hero--resource.wr-hero--split:0` | `HERO_MEDIA` / `PRIMARY_HERO` | 1440 x 560.45, cover, 50% 50% | 1 |
| 2 | `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/capabilities.jpg` | `wr-split.wr-split--reverse:2` | `APPLICATION_EXPERIENCE` / `CONTEXTUAL_SUPPORT` | 777.60 x 580, cover, 50% 50% | 2 |
| 3 | `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/commercial-stainless-counters.jpg` | `wr-section.wr-section--steel:3` | `SUPPORTING_MEDIA` / `RELATED_CARD` | 401.33 x 180, cover, 50% 50% | 1 |
| 4 | `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/capabilities.jpg` | `wr-section.wr-section--steel:3` | `SUPPORTING_MEDIA` / `RELATED_CARD` | 401.34 x 180, cover, 50% 50% | 2 |
| 5 | `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/request-a-quote.jpg` | `wr-section.wr-section--steel:3` | `SUPPORTING_MEDIA` / `RELATED_CARD` | 401.34 x 180, cover, 50% 50% | 1 |

No host/theme media instance exists in the staged composition.

## Reuse classification

Repeated source: `capabilities.jpg`, existing media 44.

Classification: `UNRESOLVED_DUPLICATION`.

The two roles are genuinely different: the large split image supports the “What to expect” workflow explanation, while the smaller card links to the Capabilities resource. Their sections and container layouts are also different. However, both use the same centered 50%/50% crop, appear within roughly one section of scroll distance, and no owner-approved reuse declaration authorizes both placements. The fail-closed policy therefore cannot classify this as intentional semantic reuse.

Both labels explicitly say “Conceptual,” and the split caption identifies an existing generated visual. The reuse does not create a false impression of two documentary projects, so claim safety is preserved.

## Owner recommendation

`REPLACE_ONE_INSTANCE`

Keep the larger `CONTEXTUAL_SUPPORT` split image because it carries the stronger explanatory role. Replace only the Capabilities related-resource card image with another approved conceptual asset. This preserves section rhythm and card navigation while reducing immediate visual repetition. No replacement was executed.

## Responsive review

All five images resolve at each viewport, H1 and CTAs remain usable, header/footer structure is intact, and horizontal overflow is zero.

| Viewport | Split occurrence | Card occurrence | Result |
|---:|---|---|---|
| 1440 | 777.60 x 580 | 401.34 x 180 | PASS |
| 1024 | 552.96 x 580 | 313.34 x 180 | PASS |
| 768 | 768 x 519.16 | 351 x 180 | PASS |
| 375 | 375 x 300 | 347 x 180 | PASS |

Approved staged captures:

- [1440 px](assets/commercial-stainless-wordpress-wave-1/wp-23-staged-1440.png)
- [1024 px](assets/commercial-stainless-wordpress-wave-1/wp-23-staged-1024.png)
- [768 px](assets/commercial-stainless-wordpress-wave-1/wp-23-staged-768.png)
- [375 px](assets/commercial-stainless-wordpress-wave-1/wp-23-staged-375.png)

## Regression state

Pages 24, 11, 13, and 17 remain `PUBLIC_CERTIFIED`. Homepage and Design-Build remain at their established hashes. The public estate remains 15 unique pages. Page 23 remains untouched with ordinary theme featured-image rendering. Wave 2, Wave 3, and Agent 1 were not modified.
