# Commercial Stainless Visual Composition Learning V1

This report records candidate, site-neutral composition lessons from the Commercial Stainless repair. It does not change Genesis generation rules.

## Evidence

- Before certification: `visual-certification-424e2ea8-7efe-4e74-94aa-1d48c9fbbf4e`
- After certification: `visual-certification-ecb5e23a-c7af-4ff4-b8f1-0b64a0edfdd7`
- Before desktop canvas: 645px of 1440px (44.79%)
- After desktop canvas: 1240px of 1440px (86.11%)
- Before overall result: `WARNING`
- After overall result: `PASS`

## Candidate Rules

| Candidate | Observed problem | Repair | Before evidence | After evidence | Potential reusable rule | Confidence | Institutionalize now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DESKTOP_CANVAS_UTILIZATION` | A full-width marketing page remained in a narrow editorial column. | Established a bounded 1240px primary composition at 1440px. | 645px / 44.79%; constrained-canvas warning. | 1240px / 86.11%; rule passes. | Flag full-width marketing pages with large symmetric unused space and low measured utilization. | High | Candidate already bounded by the visual rules engine; collect more site examples before changing generation defaults. |
| `HERO_COMPOSITION` | Branded hero content was separated from its primary visual. | Integrated the existing approved media into one semantic hero with primary and secondary CTAs. | Separate featured image and 645px hero. | Semantic 1240px hero; hero rule passes. | Require one identifiable hero composition when page authority declares a marketing homepage. | High | Requires more examples. |
| `DUPLICATE_OPENING_MEDIA` | The theme featured image repeated the same source immediately above the hero. | Hid the page-scoped theme wrapper while retaining media ID 41 as the hero source. | Standalone 645×430 image before hero. | No separate opening image; provenance unchanged. | Warn when identical authoritative media appears in adjacent opening regions. | High | Requires a deterministic media-identity detector. |
| `SECTION_WIDTH_VARIATION` | Every section inherited the same narrow measure. | Used wide cards, a 55/45 capability split, controlled prose, and wide CTA bands inside one primary system. | All major sections 645px. | Major sections 1240px with bounded inner measures. | Permit section-specific grids and prose measures within a stable page canvas. | Medium | Requires more examples. |
| `TEXT_MEASURE` | Long content was narrow because the whole layout was narrow, not because prose was intentionally bounded. | Kept prose near 650-820px while widening section composition. | 645px total canvas. | 1240px canvas with 650-820px prose measures. | Evaluate prose width separately from section width. | High | Safe as guidance, not a hard global threshold. |
| `SPLIT_SECTION_PROPORTION` | The image/text split stacked into a 1493px tall narrow section. | Used a 55/45 desktop process/content split and intentional stacking below 768px. | 645×1493px split. | Wide two-column desktop split; stacked mobile layout. | Prefer bounded split ratios on wide viewports and explicit stacking breakpoints. | Medium | Requires more examples. |
| `CARD_SCALE` | Product and industry cards were too small to carry hierarchy. | Added five substantial product cards and a six-item industry grid with stable dimensions. | Small cards in a 645px canvas. | Product cards 365-556px and industry cards 368px at 1440px. | Set minimum interactive area and use available columns based on viewport and item count. | Medium | Requires more examples. |
| `VISUAL_RHYTHM` | Repeated narrow blocks produced an editorial scroll without commercial hierarchy. | Alternated hero, product grid, dark capability split, light industry grid, dark value section, and red CTA. | Six similarly constrained sections. | Six distinct semantic sections with controlled contrast and spacing. | Require section-role variation rather than uniform wrappers. | Medium | Requires more examples. |
| `CTA_PROMINENCE` | The conversion section inherited the narrow article column. | Promoted Request a Quote into a wide red conversion band while preserving its destination. | 645px CTA. | 1240px CTA at desktop; full usable mobile width. | CTA prominence should reflect declared conversion hierarchy without changing behavior. | High | Safe as guidance. |
| `MEDIA_DIVERSITY` | One approved image appeared twice at the opening. | Used the approved image once; used non-figurative process structure elsewhere. | Duplicate opening use. | One authoritative hero use; no generated media. | Prefer one strong use over repeated reuse when only one approved asset exists. | High | Safe as guidance. |
| `RESPONSIVE_COMPOSITION` | Desktop did not exploit width, although mobile remained functional. | Added explicit 1024px, 768px, and 520px composition transitions. | 645px at desktop; 300px at mobile. | 1240/940/720/340px at 1440/1024/768/375; zero overflow. | Validate composition at multiple breakpoints, not only desktop and mobile endpoints. | High | Safe as a validation practice. |

## Scope Decision

No rule above has been added to the global generation system. The findings are candidates for `GENESIS_RICH_PAGE_COMPOSITION_V1` and should be tested against additional sites and page types before becoming defaults.
