# Commercial Stainless Page 23 Governed Revision Staging V1

## Authorization and scope

The owner authorized only a staged media assignment repair for WordPress object 23, `/about/`, profile `RESOURCE`. Publication, Wave 2, Wave 3, new WordPress users, and credential provisioning were not authorized.

Approved change:

- Preserve `capabilities.jpg` as `APPLICATION_EXPERIENCE / CONTEXTUAL_SUPPORT`.
- Replace `capabilities.jpg` only in the `SUPPORTING_MEDIA / RELATED_CARD` linking to Capabilities.
- Use existing media 50, `design-build-fabrication.jpg`, an approved Genesis-generated contextual visual.

## Durable prior authority

Before the WordPress autosave update, Genesis persisted the exact prior and current identities under evidence `csc-page23-media-repair-v1-7408944090acce3b`:

- Prior autosave ID: 92.
- Prior autosave content hash: `f12ea05f629d60988a31969b138b472caffde88833557422cf5766a388602dc0`.
- Prior autosave rendered hash: `f9a0548798c8dc98fa8030366f179f02774f2f3c2a82d1123e3f40bdc31f6123`.
- Published parent `post_content` hash: `6ce1b62f02a4a1c4fae453fba5263fc1ae65415a6a85b2475fb4ad0a27f2120f`.
- Public main hash: `cb550e5dc345de132fd9b03636517ec430fd01a916052cec7a1994283f7f3308`.
- WordPress revision identities: 38, 69, and 92.
- Slug: `about`.
- Featured media: 68.
- Canonical: `https://commercialstainlesscounters.com/about/`.
- Status: `publish`.

The evidence contains the exact prior autosave content and is independently recoverable. Autosave 92 is not the sole rollback authority.

## Revision authority

WordPress reused autosave revision 92 and did not create a new native revision. Pre- and post-write revision IDs remained `38,69,92`.

The operation therefore does not claim native revision-backed staging. The immutable before/after audit boundary is `GENESIS_DURABLE_EQUIVALENT`, as explicitly permitted by the owner authorization.

- Native post-repair revision created: false.
- Genesis post-repair authority: `csc-page23-media-repair-v1-7408944090acce3b`.
- Exact repaired autosave content hash: `7408944090acce3b273c48e875f5eeace9f646ec31801a4a4865a70785d1c89d`.
- Repaired rendered hash: `b3c5da4b6ea76c96338f10ea7983fe5674a859c59cb15008c3644917a143294d`.

## Bounded mutation proof

The prior content is reproduced byte-for-byte by reversing exactly two changes in the repaired content:

1. `design-build-fabrication.jpg` back to `capabilities.jpg` in the unique Capabilities related card.
2. `Conceptual fabrication capability context for Capabilities` back to `Conceptual context for Capabilities`.

No copy, section order, profile, CTA, SEO, URL, canonical, slug, featured media, or published parent content changed.

## Media authority and semantic policy

Media 50 is an existing approved Genesis-generated visual for Design-Build Fabrication. WordPress metadata expressly prohibits implying a customer, actual project, certification, or location. Its use remains conceptual and is semantically appropriate for a Capabilities card because it depicts a governed fabrication capability context.

The repaired candidate contains five unique media sources:

1. `about.jpg` — `HERO_MEDIA / PRIMARY_HERO`.
2. `capabilities.jpg` — `APPLICATION_EXPERIENCE / CONTEXTUAL_SUPPORT`.
3. `commercial-stainless-counters.jpg` — `SUPPORTING_MEDIA / RELATED_CARD`.
4. `design-build-fabrication.jpg` — `SUPPORTING_MEDIA / RELATED_CARD` for Capabilities.
5. `request-a-quote.jpg` — `SUPPORTING_MEDIA / RELATED_CARD`.

Semantic policy result:

- Media instances: 5.
- Repeated sources: 0.
- Host duplication: 0.
- Accidental composition duplication: 0.
- Intentional semantic reuse: 0.
- Unresolved duplication: 0.
- Policy: pass.

## Responsive owner review

Certification: `csc-page23-media-repair-v1-owner-review-20260914T0604Z`.

| Viewport | Replacement card image | Overflow | Result |
|---:|---:|---:|---|
| 1440 | 401.34 x 180 | 0 | PASS |
| 1024 | 313.34 x 180 | 0 | PASS |
| 768 | 351 x 180 | 0 | PASS |
| 375 | 347 x 180 | 0 | PASS |

All media resolved. The primary Capabilities split remained intact, section rhythm and text/media balance were preserved, and the replacement crop remained acceptable.

Owner review route:

`http://localhost:3013/sites/site-rj-metal-commercial-stainless-counters/build/rich-composition-wave-1-wordpress?organizationId=rj-metal&siteId=site-rj-metal-commercial-stainless-counters`

## Publication lock and public safety

The stage record is `OWNER_REVIEW_READY`, not `PUBLICATION_READY`. Prepublication inspection returns `OWNER_REVIEW_ONLY`, and the publisher requires `PUBLICATION_READY`, so a new explicit owner authorization is required.

The published About page remained unchanged at hash `cb550e5dc345de132fd9b03636517ec430fd01a916052cec7a1994283f7f3308`. Pages 24, 11, 13, and 17 remain public-certified. Homepage, Design-Build, the 15-page estate, Agent 1, and ProjectorEnclosure were not modified.
