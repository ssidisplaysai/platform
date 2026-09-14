# Genesis Background-Aware Text Contrast V1

> **Invalidation notice:** The earlier San Antonio owner/publication readiness conclusion is invalidated by `GENESIS_NATIVE_PREVIEW_CONTRAST_CERTIFICATION_MISMATCH_V1`. Its evidence authority was a signed host-equivalent reconstruction, not an authenticated native WordPress preview. Owner and publication readiness are blocked until actual native-host evidence resolves the contradiction.

## Shared Contract

`GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_V1` is a site-neutral rendered contrast contract. It supports light/dark solids, light/dark images, image overlays, gradients, and mixed/unknown backgrounds. It evaluates eyebrow, H1-H3, display heading, body, primary/secondary CTA, caption, disclaimer, and label roles.

Every rendered observation persists foreground color, effective background color, background type/luminance, overlay authority, required contrast, actual ratio, pass state, and resolved treatment. Image-backed regions without a sufficiently opaque approved overlay fail closed as `IMAGE_REGION_UNRESOLVED`. Generated image regions are reevaluated during each viewport capture.

The shared capture service runs 1440, 1024, 768, and 375 independently. Authority order is `ACTUAL_NATIVE_HOST_RENDER > HOST_EQUIVALENT_RENDER > GENESIS_COMPOSITION_RENDER > STATIC_CSS_EXPECTATION`. A lower authority cannot grant readiness when native evidence contradicts it. Publication contrast readiness requires stable PASS evidence from `ACTUAL_NATIVE_HOST_RENDER`; this evidence still does not authorize publication.

## Fixtures

Positive fixtures cover white-on-dark solid, dark-on-light solid, white on a dark image with an approved overlay, and dark text on a verified bright image region. Negative fixtures cover black on a dark image, black on charcoal, white on a light image, low-contrast gray body text, CTA contrast failure, and a mobile-only crop failure. A Commercial Stainless fabrication fixture proves the evaluator has no San Antonio, ProjectorEnclosure, or SSI assumptions.

## San Antonio Before Audit

Certification: `san-antonio-background-aware-contrast-before-san-antonio-hero-contrast-587bb32e-233b-4d7c-98c0-48564ab7b9a3`

- State: FAIL
- Failures: 36
- 1440: 9
- 1024: 9
- 768: 9
- 375: 9
- Unique section/role/color treatments: 8 (nine owner-visible treatment positions)

Failures included gold eyebrows on light product/planning/pathway/resource surfaces, dark Product in Context H2 on charcoal, dark Application Experience H2 on a dark image/overlay, and the final red CTA eyebrow/H2.

## Bounded WordPress Mutation

Receipt: `san-antonio-systemic-contrast-a77d74bc-429a-4c34-8d53-8895a3b78a3f`

- WordPress object: `13103`
- Status: `draft`
- Before hash: `ce3dd9ca1ba02a64ae0d7e25f42c628d8e6159af84f3ee395659f92c8698cecb`
- After hash: `3d0a848aae7128153381defb7334addb1f5324deba7ab3a17ba6683f9e9b36e2`
- Artifact SHA: `0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2`

The transform adds only the shared CSS contract, background-luminance/authority attributes, and the contract marker. Removing those additions reproduces the prior POST_CONTENT exactly. Copy hash, section sequence, media URL sequence, SEO hash, slug, parent, template, H1 count, featured media `10757`, and draft status are unchanged.

## San Antonio After Audit

Certification: `san-antonio-background-aware-contrast-v1_1-after-san-antonio-systemic-contrast-a77d74bc-429a-4c34-8d53-8895a3b78a3f`

- State: PASS
- Observations: 336 (84 per viewport)
- Failures: 0
- Owner-review contrast gate: INVALIDATED / BLOCKED by actual native owner evidence
- Host publication contrast gate: INVALIDATED / BLOCKED
- Generated image reevaluation: performed

These numeric results remain valid only for the signed host-equivalent reconstruction. WordPress object `13103` remains draft, and no publication authorization or mutation exists.

Representative persisted results:

- Hero H1: `rgb(255,255,255)` on effective dark overlay `rgb(27,31,32)`, 16.62:1
- Hero body: `rgb(245,247,247)` on `rgb(27,31,32)`, 15.46:1
- Hero primary CTA: `rgb(23,32,34)` on `rgb(242,184,75)`, 9.27:1
- Product Context H2: `rgb(255,255,255)` on `rgb(23,32,34)`, 16.59:1
- Product Context body: `rgb(245,247,247)` on `rgb(23,32,34)`, 15.42:1
- Application H2: `rgb(255,255,255)` on effective dark overlay `rgb(24,29,30)`, 17.03:1
- Application body: `rgb(245,247,247)` on `rgb(24,29,30)`, 15.84:1
- Regional H2: `rgb(25,25,25)` on `rgb(243,241,235)`, 15.57:1
- Regional body: dark copy on a light surface, PASS
- Final CTA eyebrow/H2: white on `rgb(179,38,30)`, 6.54:1
- Final CTA body: `rgb(245,247,247)` on `rgb(179,38,30)`, 6.08:1
- Final CTA button: `rgb(23,32,34)` on `rgb(242,184,75)`, 9.27:1

## Geometry And Safety

Before/after geometry is identical at all viewports: product section/media/copy widths, contextual copy widths, word-fragment counts, and horizontal overflow. Desktop remains 55/45; tablet/mobile remain intentionally stacked. Duplicate theme title and featured-image presentation remain suppressed.

No publication, content generation, media generation, workflow, or dispatch occurred. San Antonio remains draft and publicly unavailable. Dallas, Houston, Austin, and Commercial Stainless remain outside this object-scoped mutation.