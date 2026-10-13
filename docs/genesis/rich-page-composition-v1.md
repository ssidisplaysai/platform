# Genesis Rich Page Composition V1

## Purpose

Rich Page Composition V1 is a site-neutral planning and evaluation capability. It organizes approved content, media, conversion, and responsive intent before rendering. It does not generate arbitrary HTML or CSS, replace content authority, approve media, or authorize publication.

Contract: `site-page-composition-plan-v1`

Ruleset: `genesis-rich-page-composition-rules-v1`

## Composition Profiles

- `PRODUCT_SERVICE`: product and service explanation with product truth, supporting context, benefits, and conversion intent.
- `LOCATION_SERVICE`: service authority plus truthful geographic context; no fake landmarks, customers, or local claims.
- `MARKET_INDUSTRY`: governed market context and relevant solution pathways.
- `CAPABILITY`: capability explanation, requirements, process, and supporting evidence.
- `EDITORIAL_RESOURCE`: reading-led composition where a narrow prose column may be intentional.
- `LANDING_CONVERSION`: broad visual hierarchy and approved conversion intent.

Profiles constrain permissible layout intent. They do not replace existing page-type or content authority.

## V1 Rules Supported By Approved Evidence

- `DESKTOP_CANVAS_UTILIZATION`: distinguish page canvas from prose measure; warn only for bounded severe constraint with large symmetric unused space.
- `HERO_COMPOSITION`: evaluate semantic hero and H1 geometry when authoritative markers exist.
- `DUPLICATE_OPENING_MEDIA`: detect repeated exact media identity in adjacent opening regions when evidence is available.
- `SECTION_WIDTH_VARIATION`: recognize deliberate wide, standard, reading, split, grid, and conversion-band intent.
- `TEXT_MEASURE`: evaluate prose independently from page width.
- `RESPONSIVE_COMPOSITION`: require desktop and mobile evidence and no horizontal overflow.
- `MEDIA_DIVERSITY`: consume `site-page-media-assignment-v1` roles without creating assignments.
- `GLOBAL_HEADER_ALIGNMENT`: compare measured header and primary body widths when both are available.
- `GLOBAL_CTA_HIERARCHY`: evaluate only when approved conversion authority exists.

## Advisory Heuristics

The following remain advisory because current rendered evidence does not expose every semantic child bound consistently:

- `SPLIT_SECTION_PROPORTION`
- `CARD_SCALE`
- `VISUAL_RHYTHM`
- `CTA_PROMINENCE`

Missing selectors or geometry produce `NOT_EVALUATED`, not invented certainty.

## Media Authority

Rich Composition references existing assignments by role and slot:

- `PRODUCT_AUTHORITY` must be an approved existing product asset and cannot be fabricated or replaced by contextual media.
- `CONTEXTUAL_IN_USE` may use approved existing media or generated media grounded through a `PRODUCT_TRUTH` reference.
- A legacy featured image may be represented as `LEGACY`, but this does not create a `site-page-media-assignment-v1` assignment.
- Required but unassigned product authority is `NOT_WIRED` and blocks plan readiness.

The legacy GLW target adapter remains a known gap. V1 reads legacy contextual evidence and external product authority, but does not mutate targets or manufacture assignment receipts.

## Visual Certification Integration

The composition evaluator consumes `rendered-visual-certification-v1` capture evidence and emits bounded plan findings. It does not replace visual certification. Visual `PASS` and owner `APPROVED` remain independent from publication, campaign activation, dispatch, and WordPress mutation.

## Dallas Read-Only Application

Dallas uses existing `city_service` authority and maps to `LOCATION_SERVICE`. Its plan proposes a semantic hero, product-truth split, feature grid, readable local context, value structure, FAQ, and conversion band.

Current media state:

- `PRODUCT_AUTHORITY`: `NOT_WIRED` despite external approved product authority evidence.
- `CONTEXTUAL_IN_USE`: `LEGACY` featured-media evidence.

The plan is therefore `BLOCKED`. The safe next action is to wire the approved product asset through `site-page-media-assignment-v1`. No Dallas content, WordPress object, campaign, execution, or publication state is changed.

## Site-Specific Decisions Not Globalized

Commercial Stainless is approved evidence, not a universal template. V1 does not globalize its black/white/red palette, condensed typography, 1240px canvas, 55/45 split, section wording, page IDs, media IDs, WordPress identity, or exact breakpoint choices.

Future approved examples should refine profile-specific ranges and promote advisory heuristics only when evidence supports them.
