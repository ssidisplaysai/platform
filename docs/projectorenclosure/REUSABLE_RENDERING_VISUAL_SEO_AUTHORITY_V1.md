# Reusable Rendering, Visual, and SEO Authority v1

## Elementor registry

`elementor-authority-registry.ts` is the Genesis-side source of truth. The WordPress boundary carries the same versioned, immutable tuples so requests cannot expand authority. Each tuple binds site, host, WordPress object, element ID, widget type, leaf path, mutation class, and byte limit. Script, style, media, hierarchy, page settings, global references, and every non-target string setting are invariants unless a future registry version explicitly grants a narrower capability.

There is no wildcard page authority. Page 3810 retains semantic and certification authority. Pages 12596 and 12608 initially receive only `INERT_CERTIFICATION` authority for one exact HTML leaf each.

## SEO policy

The preferred model is hybrid: deterministic application templates for repeated, established intents; constrained generation from verified authority for novel wording; and manual exact approval where any invariant is unresolved. Modes are `MANUAL_EXACT`, `POLICY_BOUNDED`, and `AUTONOMOUS_VERIFIED`. Autonomous writes remain disabled.

Eligibility requires established ownership, intent, and product authority; deterministic identification of the unsupported meta claim; verified facts or general planning language; unchanged focus keyword, Yoast title, page title, slug, canonical, and robots; unchanged ownership; a clean semantic audit; deterministic confidence; and exact rollback evidence. Missing product authority, ambiguous or competing ownership, another SEO field requiring correction, legal/compliance content, an unverified required fact, material intent change, or lower confidence fails closed.

## Visual Product Authority

Visual classes are `EXACT_PRODUCT_IMAGE`, `VERIFIED_PRODUCT_RENDER`, `VERIFIED_PRODUCT_CONTEXT_IMAGE`, `GENERATED_PRODUCT_CONTEXT_IMAGE`, `GENERIC_CATEGORY_IMAGE`, `LEGACY_UNVERIFIED_PRODUCT_IMAGE`, `COMPETITOR_OR_NON_SSI_PRODUCT_IMAGE`, and `DECORATIVE_NON_PRODUCT_IMAGE`.

Source roles are `SSI_OWNED_PRODUCT_AUTHORITY`, `OWNER_SUPPLIED_PRODUCT_AUTHORITY`, `FACTORY_OR_MANUFACTURER_PRODUCT_AUTHORITY`, `SSI_OWNED_INSTALLATION_EVIDENCE`, `SSI_SOCIAL_INSTALLATION_EVIDENCE`, `GENERAL_ENVIRONMENT_RESEARCH`, `COMPETITOR_ENVIRONMENT_RESEARCH`, and `DISCOVERY_ONLY_VISUAL`.

Every reference records provenance, owner, product and family association, view, installation context, geometry/feature authority, environment-only status, generation permission, named-product representation permission, verification status, source URL or durable identifier, WordPress media ID, and lineage.

### Reference hierarchy

1. SSI-owned authoritative product photographs or renders.
2. Owner-supplied authoritative photographs, renders, or drawings.
3. Verified factory/manufacturer assets for the actual SSI product.
4. SSI-owned installations associated with the correct product.
5. SSI website installation imagery.
6. SSI WordPress Media Library installation assets.
7. Proven SSI-owned social installation imagery.
8. General web environment research.
9. Industry environment research.
10. Competitor or unverified social environment research.

Levels 8-10 never establish SSI geometry or features. A named product may be represented only by verified product truth for that exact product. Generic imagery is limited to genuinely generic category or educational content. Missing authority remains explicitly missing.

### Source inventory

Inventory ProjectorEnclosure and SSI WordPress Media Libraries first, retaining attachment IDs, source pages, uploads, captions, metadata, checksums, and product associations. Then reconcile existing Product Intelligence assets and owner uploads. Factory/manufacturer assets require explicit product matching. SSI social assets require account ownership plus durable post/media lineage. General web and competitor images are metadata-only research references; do not indiscriminately download or promote them.

### Visual identity packages

Each important product may declare available front, rear, side, three-quarter, open-access, ventilation-detail, mounting, dimensional, verified-render, installation, contextual, and customization references. Required but absent views are recorded in `missingViews`; they are never fabricated and promoted to authority.

### Generation manifests

Named-product generation requires a manifest separating product, installation, and environment references. Product references control geometry and visible features. Installation evidence controls plausible placement and orientation. Environment research controls architecture, lighting, audience, and composition. Permitted transformations include contextual placement, lighting, supportable viewing angles, and approved finish/wrap treatment. New vents, locks, doors, dimensions, seals, controls, mounting systems, or unsupported features are prohibited.

Autonomous image replacement remains disabled. Future enablement requires separate source, manifest, generation, visual-verification, media/page mutation, public-QA, rollback, and orphan-cleanup certification.

## Vinyl wrap authority

Owner confirmation establishes that SSI projector enclosures can be vinyl wrapped for installation-specific aesthetics to blend in, stand out, or carry custom graphics. This does not establish universal model/material compatibility, permission to cover functional openings, changes to access, weather resistance, thermal behavior, security, warranty, certification, enclosure material, installation method, lifespan, or environmental durability. Contextual/generated depictions must preserve authoritative underlying geometry and known functional openings.

## Legacy learning record

1. Discover rendering authority before mutation.
2. Treat `post_content` as a possible semantic shadow.
3. Do not assume source/public disagreement is cache.
4. Use supported Elementor document authority.
5. Save multi-leaf semantic changes atomically.
6. Discovery sources cannot create product facts.
7. HTTP 403 does not automatically mean broken.
8. URL exceptions must be exact and durable.
9. SEO independently carries product claims.
10. Repeated governance decisions should become bounded policy.
11. Mutation authority requires exact rollback.
12. Public QA is mandatory acceptance.
13. Visual product identity is an authority problem.
14. Generic/generated imagery cannot silently represent a named product.
15. Owner-confirmed customization must not imply performance.
16. Product and environment imagery have different authority roles.
17. SSI-owned media retains provenance and product association.
18. Missing visual authority remains explicitly missing.
19. Generation consumes a declared reference manifest.
20. Competitor/general-web imagery may inform context, never SSI product truth.

These rules are site-neutral and apply to Genesis-managed WordPress properties through explicit site-bound registries and product-specific authority records.