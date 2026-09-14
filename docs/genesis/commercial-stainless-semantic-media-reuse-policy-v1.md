# Commercial Stainless Semantic Media Reuse Policy V1

## Scope and safety

This change implements `COMMERCIAL_STAINLESS_SEMANTIC_MEDIA_REUSE_POLICY_V1` as an offline policy and publication-verifier repair only.

- No page was published.
- No WordPress content was mutated.
- Autosaves 91 and 92 were not modified.
- Page 17 remains rolled back and restored.
- Page 23 remains untouched.
- Pages 24, 11, and 13 retain their existing `PUBLIC_CERTIFIED` state.
- Wave 2 and Wave 3 were not started.

## Reusable policy

A rendered media instance records source identity, attachment ID or URL, semantic role, section identity, composition role, document authority, host/composition authority, explicit reuse declaration, rendered geometry, structural presentation identity, and conceptual/documentary claim class.

Repeated sources receive exactly one classification:

- `HOST_DUPLICATION`: a theme/host instance repeats a rendered source; fail.
- `COMPOSITION_ACCIDENTAL_DUPLICATION`: a composition repeats a source in the same role/section or without meaningfully different presentation; fail.
- `INTENTIONAL_SEMANTIC_REUSE`: all instances match an explicit owner-approved declaration, have distinct roles and sections, have meaningfully different presentation, are composition-owned, and are claim-safe; pass.
- `UNRESOLVED_DUPLICATION`: required intent, authority, role, section, or claim evidence is absent; fail closed.

The publication verifier still independently requires zero rendered theme featured-image wrappers. The legacy `duplicateFeaturedImage` signal now means host/theme duplication, while `semanticMediaReusePass`, `semanticMediaReuseStatus`, and `mediaDuplicationFindings` preserve the richer decision evidence.

## Page 17 offline replay

Evidence inputs:

- WordPress object 17, autosave 91.
- Autosave hash `f615de2169fbd44c03a60bd5c739e0510709baee671acc5c61ff2c421742f1ac`.
- Retained failed public HTML from receipt `csc-wave1-remaining-v1-17-91`.
- Four prior HTTP 200 reads with one stable response hash.
- Exact expected and actual stored content hashes.
- Prior sole failed predicate: `semanticIdentityValid`.

Repeated source: `education.jpg`, existing generated media 56.

| Instance | Semantic role | Section | Presentation | Claim class |
|---|---|---|---|---|
| Hero | `HERO_MEDIA` / `PRIMARY_HERO` | `wr-hero.wr-hero--industry:0` | 1440 x 610 full-bleed, `cover`, 50% 45% | `CONCEPTUAL` |
| Application split | `APPLICATION_EXPERIENCE` / `CONTEXTUAL_SUPPORT` | `wr-split:3` | 777.59 x 580 split figure, `cover`, 50% 50% | `CONCEPTUAL` |

Authority: `commercial-stainless-wave1-approved:c1d94a4b80661397a67d1ba8674c0ea8f71c3e19`.

Replay result:

- `Page17SemanticReuseStatus=GOVERNED_INTENTIONAL_REUSE`
- `Classification=INTENTIONAL_SEMANTIC_REUSE`
- `ReuseVisuallyJustified=True`
- `ClaimSafety=True`
- `HostDuplication=False`
- `AccidentalCompositionDuplication=False`
- `UnresolvedDuplication=False`
- `OfflineSemanticPolicyPass=True`

The hero establishes broad Education identity; the later split supports application and stakeholder-coordination context. Their role, location, container, dimensions, and crop differ materially. A second approved asset could improve visual variety, but the current conceptual reuse is not semantically invalid and does not imply two documentary projects.

No publish retry is authorized by this result.

## Page 23 read-only assessment

The untouched autosave 92 rendering repeats `capabilities.jpg` in:

- `APPLICATION_EXPERIENCE` / `CONTEXTUAL_SUPPORT` within `wr-split.wr-split--reverse:2`.
- `SUPPORTING_MEDIA` / `RELATED_CARD` within `wr-section.wr-section--steel:3`.

Both uses are conceptual and composition-owned, but no explicit owner-approved reuse declaration binds them.

- `Page23SemanticReuseStatus=OWNER_REVIEW_REQUIRED`
- `Classification=UNRESOLVED_DUPLICATION`
- `OfflineSemanticPolicyPass=False`
- `Page23MutationPerformed=False`

Page 23 therefore remains blocked from semantic certification until the owner either approves an explicit reuse declaration or selects a different approved asset.

## Fixture matrix

The automated policy fixtures cover:

1. Theme featured media plus the same embedded source: fail.
2. Same source, same role or section: fail.
3. Governed hero plus application role: pass.
4. Missing intent authority or metadata: fail.
5. Different sections with identical presentation: fail.
6. Different sources: pass.
7. Misleading documentary reuse: fail.
8. A second-site structural extraction fixture: policy remains site-neutral.
