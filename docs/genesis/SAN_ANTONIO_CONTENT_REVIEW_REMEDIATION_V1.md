# San Antonio Content Review Remediation V1

Date: 2026-09-13

## Immutable subject

- Execution: `608895`
- Job: `f518ffb7-9216-4866-a93c-7f4793e74038`
- Artifact SHA-256: `0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2`
- Artifact length: 19,497 characters
- Expected location: San Antonio, Texas
- Execution state: `CONTENT_READY`
- WordPress identity: none

## Location forensics

The immutable artifact is not cross-city contaminated.

| Surface | San Antonio | Texas | Dallas | Houston | Austin | Plano | California | Alaska | Florida |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Job record metadata | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Generated artifact metadata | 5 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Generated artifact HTML | 15 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The visible `Dallas, Texas` eyebrow came from a literal string in `GlwRichCompositionPreview`, so it is `RENDERER_CONTAMINATION`. The review read model also unconditionally loaded `market-dallas-north-texas` and contained Dallas-specific owner questions. Those fields are `REFERENCE_METADATA`; they were not present in the generated artifact and were not supplied by San Antonio local-context authority. No exact San Antonio local-context bundle existed.

## Reusable localization gate

`LOCALIZATION_CONTAMINATION_GATE` evaluates structured owner-visible surfaces: eyebrow, title, headings, body, CTA, alt text, metadata, and composition labels. Location candidates come from target identity, explicitly allowed local-context authority, and known sibling/reference target authority.

- Expected target city/state: `EXPECTED_LOCATION`
- Explicit context-authorized comparisons: `ALLOWED_CONTEXT_LOCATION`
- Sibling/reference residue without context authority: `FORBIDDEN_REFERENCE_LOCATION`

The gate does not prohibit geographic comparisons by string alone. An allowed comparison must be supplied with explicit context authority. Regression fixtures prove Dallas passes for Dallas, Houston passes for Houston, and the observed Dallas eyebrow fails for San Antonio.

## Product authority media

Approved documentary product media exists:

- Product: `prod-ssi-fan-cooled-projector-enclosures`
- Canonical product authority: `wordpress-page:10541`
- Product media authority: `wordpress-media:10757`
- URL: `https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp`
- SHA-256: `685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078`
- Approval: `OWNER_APPROVED_CANONICAL_PRODUCT`

The failure was resolver scope, not missing authority. The review model queried only the exact San Antonio build session/page revision, while the approved product-scoped assignment was persisted with the Dallas reference revision. The new read-only resolver reuses an asset only when organization, site, product ID, role, asset type, and authority reference all match. It performs no assignment persistence or WordPress mutation.

`PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE` now returns `REQUIRED_MEDIA_UNRESOLVED` when canonical approved media exists but no matching documentary assignment resolves. Generated media remains forbidden as a documentary substitute.

## Composition assessment

Current profile: `LOCATION_SERVICE`.

The generated source provides a valid H1, substantial localized body content, FAQ, internal links, and CTA copy. It does not provide the governed presentation package required for another owner review. Missing capabilities are:

- exact `LOCAL_CONTEXT` authority bundle for San Antonio;
- exact `APPLICATION_CONTEXT` authority and application selection;
- semantic `CONTEXTUAL_IN_USE`, `APPLICATION_EXPERIENCE`, and `LOCAL_CONTEXTUAL_ATMOSPHERE` media assignments;
- responsive desktop/mobile composition evidence;
- rendered CTA prominence and global CTA hierarchy evidence;
- visual rhythm, prose measure, split proportion, and section-width evidence.

Approved product authority is now resolved and rendered in the non-mutating preview. Contextual media remains unavailable and is not replaced with fabricated documentary imagery.

## Readiness and remediation

The read model reports `REVIEW_BLOCKED` for this `content_ready` city page because its governed localized composition bundle is absent. Historical generation truth remains `CONTENT_READY`; owner-review readiness is a separate state.

Deterministic repair is possible without another n8n generation because the source artifact is location-clean and structurally usable. The next governed action is to build a San Antonio-specific, non-mutating localized composition bundle from the existing artifact, using approved product media `10757`, independently sourced San Antonio local context, evidence-backed application context, semantically assigned non-documentary contextual media, and responsive visual certification. Regeneration is not currently justified.

## Mutation boundary

This remediation created no WordPress object, changed no WordPress object, published nothing, dispatched nothing, and executed no workflow. Dallas, Houston, and Commercial Stainless content and persistence were not modified.