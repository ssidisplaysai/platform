# Genesis Local Context and Page Theming V1

## Governing principles

**Localization should create familiarity without fabricating proximity.**

**Brand authority + local context = localized brand expression.**

Local context does not create a new brand, replace an approved logo, change product truth, establish a local office, prove a local customer, or turn a conceptual scene into documentary evidence.

## Authority chain

```text
BRAND AUTHORITY
        +
PRODUCT AUTHORITY
        +
APPLICATION AUTHORITY
        +
LOCAL CONTEXT
        +
LOCAL LINK GRAPH
        +
LOCAL THEME PROFILE
        +
MEDIA AUTHORITY
        ->
RICH COMPOSITION PLAN
        ->
NON-MUTATING PREVIEW
        ->
VISUAL CERTIFICATION
        ->
OWNER REVIEW
```

## Contracts

### `site-page-local-context-v1`

Binds sourced local facts to organization, site, page, job, exact page revision, geography, research revision, retrieval time, verification time, and source provenance. Every substantive fact must reference one or more verified evidence records. Accepted evidence classes are government, official institution, owner authority, official brand, and official venue.

The contract can represent climate/environment, built environment, market characteristics, industries, venue types, terminology, regulatory context, visual cues, and application opportunities. An HTTP success alone does not authorize arbitrary claims; the recorded observation must remain narrower than the source.

### `site-page-local-link-graph-v1`

Link roles are:

- `INTERNAL_PRODUCT`
- `INTERNAL_APPLICATION`
- `INTERNAL_CAPABILITY`
- `INTERNAL_SUPPORT`
- `INTERNAL_CONVERSION`
- `LOCAL_AUTHORITY`
- `LOCAL_INSTITUTION`
- `REGIONAL_REFERENCE`

Every link records destination identity where known, anchor intent, reason for inclusion, evidence references, HTTP verification state, verification time, page revision, and research revision. Unverified, unsupported, non-HTTPS, stale, or unjustified links fail validation.

### `site-page-application-authority-v1`

Application authority describes what an approved product can enable without competing with product truth. Application domains are extensible. Compatibility is `SUPPORTED`, `REVIEW_REQUIRED`, or `UNSUPPORTED`; only sourced relationships may be `SUPPORTED`.

Dallas V1 resolves `PROJECTION_MAPPING`, `COMMERCIAL_AV`, and `EVENT_VENUE` as supported. `MUSEUM_ATTRACTION` remains review-required. The canonical fan-cooled product page explicitly includes projection mapping setups, but does not prove any Dallas customer, venue, installation, or performance specification.

### `site-page-local-theme-profile-v1`

The profile derives from brand authority, local context, and application authority. It may guide atmosphere, environmental imagery, material cues, accents, density, terminology, and composition emphasis. It may not override logo, typography, product, content, SEO, or navigation authority.

Brand precedence is mandatory. A stale local-context or application revision invalidates the profile.

### `site-page-localized-composition-plan-v2`

V2 binds the exact page revision to local context, link graph, application authority, theme profile, and semantic media IDs. It records the prior plan identity and permanently sets `wordpressMutationAuthorized` to `false`. Missing required media or blockers prevent `READY_FOR_OWNER_REVIEW`.

### `local-theme-visual-certification-v1`

Preview-only certification captures 1440, 1024, 768, and 375 pixel widths. It evaluates overflow, hero and CTA geometry, semantic media visibility, and section rhythm. Regional authenticity, brand/local balance, in-use credibility, and application impact remain owner-review judgments. This certification never counts as current WordPress render certification.

## Localization levels

- Level 0: brand only; no meaningful localization.
- Level 1: restrained regional atmosphere.
- Level 2: clear local character through sourced environment, architecture, terminology, and planning context.
- Level 3: recognizable geographic reference. This requires specific evidence and is not the default.

Dallas uses Level 2. It uses broad North Texas sky, contemporary glass and steel, masonry, civic arts architecture, and large event-space scale without reproducing a recognizable venue or landmark.

## Media roles and claim classes

Semantic media roles remain distinct:

- `PRODUCT_AUTHORITY`: approved representation of the actual product.
- `CONTEXTUAL_IN_USE`: product shown in a credible use environment.
- `APPLICATION_EXPERIENCE`: the experience or result enabled by an authorized application.
- `LOCAL_CONTEXTUAL_ATMOSPHERE`: environmental imagery used for regional familiarity.

Claim classes are `DOCUMENTARY`, `CONCEPTUAL_CONTEXTUAL`, `ATMOSPHERIC`, and `APPLICATION_VISUALIZATION`.

Generated media cannot become product authority. Generated in-use and application media must carry approved `PRODUCT_TRUTH` grounding. Local atmosphere must carry the `ATMOSPHERIC` claim class. Generated media remains pending until owner review.

Alt, title, caption, and description text must preserve the claim class. Conceptual media cannot be described as an installation, customer site, local office, or completed project.

## Generated-image authority

```text
PRODUCT AUTHORITY + APPLICATION AUTHORITY + LOCAL CONTEXT
  -> bounded prompt
  -> generated candidate
  -> binary hash and provenance
  -> semantic media role
  -> owner review
```

Product-visible generation uses the approved product reference. Text-only reconstruction cannot become approved product media. Prompts prohibit readable text, logos, identifiable customers, recognizable local properties, unsupported features, impossible geometry, and documentary framing.

## Anti-cliche safeguards

Local expression is rejected when it relies on ungrounded caricature. Dallas defaults prohibit cowboy hats, boots, longhorns, flag motifs, desert scenes, western fonts, oil derricks, ranch imagery, and red-white-blue theming. A specifically authorized context could override an item only through new evidence and review.

## False-proximity safeguards

The system must not infer or imply:

- an SSI or ProjectorEnclosure local office;
- Texas headquarters;
- a Dallas customer or contract;
- an actual Dallas installation;
- ownership of a depicted local venue;
- that SSI performed a depicted project.

Generated Dallas imagery is conceptual or atmospheric, never documentary. Visible preview disclosures reinforce this boundary.

## Research requirements

Use official and attributable sources. Preferred classes include government, official agencies, official institutions, official venues, and owner-controlled properties. Avoid SEO farms, scraped directories, affiliate pages, and generated summaries. Each selected link needs a buyer-oriented reason, not a link-count rationale.

Dallas proof uses official ProjectorEnclosure/SSI pages, National Weather Service Fort Worth/Dallas climate material, City of Dallas Office of Arts and Culture venue/public-art material, and the official Kay Bailey Hutchison Convention Center site.

## Owner review

Geometry and source validation cannot decide whether a regional treatment feels authentic. The owner must assess:

1. Does this feel like ProjectorEnclosure?
2. Does this feel relevant to Dallas and North Texas?
3. Does it avoid Texas cliché?
4. Does the product look real and correct?
5. Does the in-use scene look credible?
6. Does projection mapping communicate a major application?
7. Do the links make the page more useful?
8. Does anything imply a local office, customer, or actual Dallas installation?

Approval of preview visuals does not authorize WordPress mutation, publication, campaign transition, or dispatch.
