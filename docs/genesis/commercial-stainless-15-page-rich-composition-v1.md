# Commercial Stainless 15-Page Rich Composition V1

## Scope and stop condition

This work creates one non-mutating Design-Build Fabrication proof and a rollout plan. It does not update WordPress, publish content, create campaigns, generate media, modify the certified header/footer/navigation, or apply changes to the other fourteen pages. Owner review is required before any later implementation.

## Current weaknesses

The current Design-Build page is constrained by the active theme to a 645px page/hero canvas at a 1425px desktop viewport, with a 605px internal wrap. The global header ends at `Y=119`, while the actual body hero starts at `Y=904.19`, leaving a `785.19px` desktop gap. Mobile leaves approximately `445.59px`. The page body also embeds a second utility bar, brand header, navigation, and footer below the certified global shell. Repeated narrow prose/card sections create an SEO-document rhythm, underuse approved media, and weaken CTA hierarchy.

## Visual principles

- Use a 1240px maximum content system with readable prose measures.
- Extract and preserve the exact live WordPress global header and footer; page bodies never recreate either.
- Lead with an integrated, full-width image hero using black overlay, white type, and red accent.
- Use the existing display/body typography and black, white, red, and neutral steel palette.
- Alternate wide grids, process steps, split media/copy, industry modules, project inputs, and CTA bands.
- Use existing approved media as conceptual product, capability, and industry context. Never imply a documented Rocklin Metal/CSC project without evidence.
- Keep Request a Quote primary and use contextual secondary pathways.
- Use fixed responsive typography at 1100px, 800px, and 520px breakpoints; do not scale type continuously with viewport width.

## Page profiles

| WordPress IDs | Pages | Profile |
|---|---|---|
| 10, 24 | Home; Request a Quote | LANDING_CONVERSION |
| 11 | Capabilities | CAPABILITY |
| 12, 13, 15, 16 | Commercial Stainless Counters; Worktables; Mobile Workstations; Countertops | PRODUCT_SERVICE |
| 14 | Design-Build Fabrication | DESIGN_BUILD |
| 17-22 | Education; Foodservice; Healthcare; Hospitality; Industrial; Labs | INDUSTRY_APPLICATION |
| 23 | About | RESOURCE |

## Design-Build proof

The proof preserves WordPress object 14, `/design-build-fabrication/`, the existing H1, title, meta description, canonical, indexability intent, valid links, and media identities. Its composition contains:

1. Integrated fabrication hero with Request a Quote and Explore Capabilities.
2. Four-part value band: Commercial Grade, Custom Fabrication, Project-Focused, and Nationwide Service, with conservative project-location scope copy.
3. Media-backed approved offering grid.
4. Five-step requirement and fabrication-planning process.
5. Split capability/context section.
6. Six approved industry pathways.
7. Project-input checklist.
8. Strong final Request a Quote band.

Reusable CSC primitives are `CSC Hero`, `CSC Benefit Band`, `CSC Product Card Grid`, `CSC Process Steps`, `CSC Split Capability Section`, `CSC Industry Card Grid`, `CSC Project Inputs`, `CSC Quote CTA Band`, and the certified shell context. These remain scoped to Commercial Stainless.

## Media rules

The proof reuses current WordPress media only. Media provenance remains visible in the owner review. Generated visuals are treated as conceptual/application context, not documentary customer-project evidence. No preview action can generate, upload, replace, or publish media.

## Responsive rules

The owner route compares complete, uncropped current and proposed pages at 1440px and 375px and exposes complete proposed previews at 1024px and 768px. The proposed hero begins immediately at the exact global header boundary (`HeaderToHeroGap=0`). Acceptance requires no horizontal document overflow, intentional card/step collapse, readable text measure, integrated hero framing, visible CTA hierarchy, and one exact global shell.

## Remaining 14-page rollout plan

| Page | Profile | Key treatment | Special consideration |
|---|---|---|---|
| Home | LANDING_CONVERSION | No proof-stage change | Preserve approved homepage exactly. |
| Capabilities | CAPABILITY | Fabrication hero, workflow, strengths, industries, project inputs | Do not imply unsupported engineering/certification services. |
| Commercial Stainless Counters | PRODUCT_SERVICE | Category hero, solution modules, application context, industries | Retain category ownership. |
| Commercial Worktables & Prep Tables | PRODUCT_SERVICE | Worktable hero, benefits, use context, related solutions | Avoid unsupported specifications. |
| Mobile & Modular Stainless Workstations | PRODUCT_SERVICE | Mobility/application hero, workflow modules, related industries | Do not imply universal configuration. |
| Stainless Countertops | PRODUCT_SERVICE | Countertop hero, application/value modules, related solutions | Keep project details conditional. |
| Education | INDUSTRY_APPLICATION | Education environment, requirements, solutions, related capability | Conceptual media only. |
| Foodservice | INDUSTRY_APPLICATION | Prep/service environment, workflow, relevant solutions | Avoid customer-project attribution. |
| Healthcare | INDUSTRY_APPLICATION | Healthcare context, cleaning/workflow considerations, solutions | Do not add compliance claims. |
| Hospitality | INDUSTRY_APPLICATION | Hospitality application hero and service-context modules | Avoid venue/customer claims. |
| Industrial | INDUSTRY_APPLICATION | Industrial workflow context and robust application modules | Avoid performance guarantees. |
| Labs | INDUSTRY_APPLICATION | Lab context, requirements, related stainless pathways | Do not add laboratory compliance claims. |
| About | RESOURCE | Project-first credibility, process expectations, capabilities | Do not invent history, locations, scale, or certifications. |
| Request a Quote | LANDING_CONVERSION | Focused conversion hero, project inputs, next steps | Do not invent contact channels or forms. |

## Owner review

Review route: `/sites/site-rj-metal-commercial-stainless-counters/build/rich-composition-review?organizationId=rj-metal&siteId=site-rj-metal-commercial-stainless-counters`.

Viewport capture evidence:

- `assets/commercial-stainless-interior-composition-v1/current-desktop-1440.png`
- `assets/commercial-stainless-interior-composition-v1/proposed-desktop-1440.png`
- `assets/commercial-stainless-interior-composition-v1/current-mobile-375.png`
- `assets/commercial-stainless-interior-composition-v1/proposed-mobile-375.png`

The captures preserve the visible global-header/content boundary. The review route itself uses measured full-document iframe heights and is the authoritative uncropped whole-page comparison.

The route is read-only and deliberately provides no Apply, Apply All, Publish, or Generate Media action. Stop after presenting this proof and wait for explicit owner direction.

## Controlled rollout Wave 1

Approved design-system reference: `d86c133510b7848865308dfc2b51e20b754192c9`.

Wave 1 creates deterministic local preview equivalents only. It does not update the five published WordPress objects, create draft duplicates, or publish anything.

| Object | Page | Profile | Primary intent | Primary CTA | Media roles |
|---:|---|---|---|---|---|
| 24 | Request a Quote | LANDING_CONVERSION | Convert available project context into a focused conversation | Request a Quote | Hero, solution context, capability context |
| 11 | Capabilities | CAPABILITY | Explain fabrication pathways, process, project inputs, and applications | Discuss Your Project | Capability hero, fabrication process, product pathways |
| 13 | Commercial Worktables & Prep Tables | PRODUCT_SERVICE | Present the approved worktable/prep-table pathway with configuration and application context | Request a Quote | Product hero, product detail, application context |
| 17 | Education Solutions | INDUSTRY_APPLICATION | Connect education requirements to appropriate products and capabilities | Discuss an Education Project | Industry hero, application context, relevant solutions |
| 23 | About | RESOURCE | Provide useful company/process context and informed next steps | Explore Capabilities | Resource hero, capability context, related pathways |

Composition diversity is deliberate: five hero variants, five section sequences, five media layouts, and five CTA-placement patterns. Shared primitives remain consistent, but no two staged pages use the same complete layout sequence.

Wave 1 certification passed all 20 page/viewport combinations: each of the five pages passed at 1440, 1024, 768, and 375 pixels with one global header, zero body navigation, one H1, above-fold identity and primary CTA, resolved approved media, no legacy top gap, no development links, and no horizontal overflow. Every original page-level internal link remains present in a contextual link band that is not navigation markup.

Wave 1 review route: `/sites/site-rj-metal-commercial-stainless-counters/build/rich-composition-wave-1?organizationId=rj-metal&siteId=site-rj-metal-commercial-stainless-counters`.

Wave 1 capture evidence is under `assets/commercial-stainless-wave-1/`, with current/proposed desktop/mobile images for each selected page.

### Future waves (plan only)

- **Wave 2:** object 12 Commercial Stainless Counters; object 15 Mobile & Modular Stainless Workstations; object 16 Stainless Countertops; object 18 Foodservice Solutions; object 19 Healthcare Solutions.
- **Wave 3:** object 20 Hospitality Solutions; object 21 Industrial Solutions; object 22 Labs Solutions.
- **Preservation hold:** object 10 Home remains unchanged and outside future rollout waves.

No Wave 2 or Wave 3 staging or mutation is authorized by this document.

## WordPress Wave 1 staging

The five approved compositions are staged as private native WordPress autosave revisions under their existing published parent objects. Public parents remain `publish`; no slug, URL, SEO, media, canonical, indexability, or parent content write occurs.

| Parent object | Profile | Native autosave | Operative authority | State |
|---:|---|---:|---|---|
| 24 | LANDING_CONVERSION | 88 | POST_CONTENT_BLOCK_HTML | PUBLICATION_READY |
| 11 | CAPABILITY | 89 | POST_CONTENT_BLOCK_HTML | PUBLICATION_READY |
| 13 | PRODUCT_SERVICE | 90 | POST_CONTENT_BLOCK_HTML | PUBLICATION_READY |
| 17 | INDUSTRY_APPLICATION | 91 | POST_CONTENT_BLOCK_HTML | PUBLICATION_READY |
| 23 | RESOURCE | 92 | POST_CONTENT_BLOCK_HTML | PUBLICATION_READY |

Preflight found no existing editor autosaves and confirmed native autosave `POST`, exact revision `DELETE`, authenticated private reads, current page-body hashes, public-body hashes, SEO fields, media IDs, and exact public shell authority. Rollback evidence was persisted before each autosave write. Rollback consists of deleting the exact autosave revision; published parent restoration is unnecessary because the parent was never changed. The original raw post content is also retained in rollback evidence.

Certification uses WordPress's actual autosave `content.rendered` output within the exact live global shell. All five pages passed at 1440, 1024, 768, and 375 pixels. The active theme contributes a bounded 70px desktop, 53.76px tablet, and 30px mobile main-area spacing; the legacy 445-785px gap is absent.

WordPress staging review route: `/sites/site-rj-metal-commercial-stainless-counters/build/rich-composition-wave-1-wordpress?organizationId=rj-metal&siteId=site-rj-metal-commercial-stainless-counters`.

Actual WordPress staging captures are under `assets/commercial-stainless-wordpress-wave-1/`: four staged widths for each object plus current desktop/mobile controls. Publication was unavailable until the separate owner authorization recorded below.

## WordPress Wave 1 publication attempt

Owner authorization `COMMERCIAL_STAINLESS_WAVE_1_PUBLICATION_V1:APPROVED` authorized only objects 24, 11, 13, 17, and 23 from autosaves 88, 89, 90, 91, and 92. The bounded publication implementation records rollback evidence before each write, verifies the exact autosave raw and rendered hashes, updates only `post_content`, and requires public semantic and responsive visual certification before allowing the next object.

The first transaction, object 24 from autosave 88, failed closed during immediate public verification with `IDENTITY_DRIFT` and `SEMANTIC_FAILURE`. Genesis restored the exact pre-publication raw content before stopping the wave. The rollback receipt is `csc-wave1-publication-24-88`; its pre-publication raw-content hash is `3829c2a5e5c322552dba1c4217ca4ea41236606b98ea1ff6a3e598ba182e3b41`, and its restored public-main hash is `c5cb250d3ffe4ead59cc23a68d1b69d268eda64644a7baab5cb0c11f7a203734`.

Post-rollback verification confirmed:

- Object 24 is restored, published, and does not expose the staged `.wr-page` composition.
- Autosave 88 still exists and remains associated with the certified stage record.
- Objects 11, 13, 17, and 23 were not mutated.
- Homepage object 10 remains at public-main hash `691fe041b4fd669e29cd7f9583524acfd1152dede8c9864493c04bdbdfc17247`.
- Design-Build object 14 remains published at public-main hash `2b78a67a1273a3fde3cd2064e4b879f48f21b53dcf91fc9f16f55fea9fcc2d0d`.
- The published estate remains exactly objects 10 through 24, with no duplicate URL and no unintended publication.
- Wave 2 and Wave 3 remain untouched.

The owner review route now reads durable publication receipts and exposes direct public-page links. It contains no Wave 2 mutation action. This publication attempt is stopped and must not be resumed without a new owner decision after the verification mismatch is diagnosed.