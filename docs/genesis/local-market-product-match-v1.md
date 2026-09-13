# Genesis Local Market Product Match V1

## Governing principle

**Genesis starts with opportunity, not pages.**

The required reasoning chain is:

```text
MARKET EVIDENCE
  -> APPLICATION
  -> APPROVED CATALOG MATCH
```

It is not:

```text
CITY NAME
  -> RANDOM PRODUCT
```

Market opportunity records are planning evidence. They do not become factual sales claims, prove demand volume, establish market leadership, identify customers, authorize campaigns, or authorize publication.

## Market intelligence

`site-market-intelligence-v1` binds a market definition, research revision, source evidence, buyer verticals, market signals, confidence, freshness, research time, and provenance.

Every market signal must cite one or more evidence records. Sources must have a successful HTTP verification, retrieval time, validity horizon, publisher, source class, and narrowly stated observed claim. V1 accepts government, official institution, official venue, owner authority, and approved catalog evidence.

The signal taxonomy is extensible. V1 includes vertical presence, infrastructure growth, venue, education, sports, museum/attraction, hospitality, corporate development, events/experiential, outdoor environment, climate exposure, building activity, technology adoption, public sector, convention/tourism, and commercial real estate.

Competitive intensity is explicitly `NOT_EVALUATED` when credible evidence is not collected. It is never inferred from supplier search results.

## Catalog authority

The matcher consumes existing catalog truth. It does not create products.

A catalog item records its source organization/site, kind, authority state, authority reference, supported applications, and supported buyer verticals. A recommendation can match only when:

1. the catalog item is approved;
2. an authority reference exists;
3. the application is supported;
4. the buyer vertical is compatible.

A public marketing page is not automatically an approved catalog record. Dallas therefore evaluates three current SSI catalog records, but only the two owner-approved enclosure records are eligible for matching. Authority-less projection film remains unapproved. No DVLED, transparent-display, or touch product is invented.

Commercial Stainless uses a separate `SITE_SOLUTION` authority shape in the site-creation blueprint because its approved live site architecture is the current source of product/solution truth. No duplicate product repository records are created.

## Application mapping

`mapMarketSignalsToApplications` evaluates explicit rules. Each rule names the signal classes required for an application and explains the relationship. A market signal never jumps directly to a product.

For example, Dallas projection mapping requires both `VENUE_ECOSYSTEM` and `EVENTS_EXPERIENTIAL`. Only after that mapping succeeds can the matcher test an approved product's projection-mapping compatibility.

The existing `site-page-application-authority-v1` remains the page-level compatibility authority. Market evidence decides what deserves evaluation; application and catalog authority decide what can be recommended.

## Opportunity contract and scoring

`site-market-product-opportunity-v1` records:

- market identity and buyer vertical;
- source market signals and evidence;
- application;
- matched catalog item and authority reference;
- explicit explanations for market, buyer, application, product, and confidence;
- seven visible score components;
- recommended downstream uses;
- cross-sell adjacency references;
- freshness and risks.

V1 uses categorical dimensions:

- market evidence strength;
- vertical fit;
- application fit;
- product fit;
- local-condition fit;
- commercial intent;
- catalog-authority confidence.

Confidence is `HIGH`, `MEDIUM`, `LOW`, or `INSUFFICIENT_EVIDENCE`. It is derived deterministically from the component categories. There is no opaque decimal score.

If application evidence or approved catalog compatibility is absent, confidence becomes `INSUFFICIENT_EVIDENCE`, the product match is cleared, and recommended usage becomes `DO_NOT_USE`.

## Cross-sell graph

`site-market-cross-sell-graph-v1` permits adjacency only between approved catalog items. Every edge must identify an application, an authority reference, a confidence category, a reason, and one of these bounded relationships:

- same application;
- same buyer vertical;
- same project phase;
- same environment;
- complementary hardware;
- upstream/downstream solution;
- same purchasing intent.

The Dallas graph records a low-confidence fan-cooled-to-Homeline projection adjacency because both approved records cite projection mapping, but the residential buyer intent conflicts with the commercial Dallas page. The page strategy therefore selects no cross-sell.

## Read-only adapters

### Site creation

`site-opportunity-blueprint-v1` recommends priority products, verticals, applications, page architecture, links, conversion paths, media needs, and theme/context strategy. It embeds evidence and freshness and permanently sets `mutationAuthorized` to `false`.

The Dallas blueprint recommends the approved fan-cooled enclosure, projection mapping, commercial AV, and event-venue planning. The Commercial Stainless proof consumes its verified live solution architecture for counters, worktables, countertops, modular workstations, design-build fabrication, six industry pathways, and requirements-led quoting. It does not alter that site.

### Campaign discovery

The adapter returns only high-confidence opportunities explicitly marked `CAMPAIGN_CANDIDATE`. Every result requires owner approval and sets `campaignMutationAuthorized` to `false`. It cannot create, authorize, activate, or dispatch a campaign.

### Page strategy

The adapter selects applications, links, media roles, and CTA intent for one page while preserving composition authority. Dallas selects projection mapping as primary, commercial AV and event venue as supporting, and rejects nine unsupported page adjacencies.

### Cross-sell

The adapter filters the approved adjacency graph by current product and application. It does not produce a generic related-products carousel. Dallas selects no cross-sell because the only approved adjacency has a different residential buyer intent.

## Freshness

Every source has a `validThrough` timestamp, and every signal is `CURRENT`, `STALE`, or `RESEARCH_REQUIRED`.

- Stable institutional, geographic, and catalog evidence may use a longer review horizon.
- development, project, event, or activity evidence uses a shorter horizon;
- expired supporting evidence makes its signal stale;
- absent evidence requires new research.

Stale or missing evidence cannot silently support future site, campaign, or page recommendations.

## Dallas result

The governed Dallas matrix contains ten market signals and evaluates twelve application opportunities against three actual SSI catalog records.

- High: projection mapping; commercial AV.
- Medium: event venue.
- Insufficient evidence / do not use: education campus, museum attraction, sports stadium, outdoor projection, immersive media, experiential AV, DVLED, transparent display, and interactive technology.

The insufficient rows are intentional. Market context exists for several categories, but the approved application-to-catalog chain is incomplete.

## V3 preview

The V3 preview preserves the V2 localized composition and adds only the selected high/medium market-informed application emphasis. It contains no Apply control and performs no WordPress, campaign, dispatch, site-creation, or publication mutation.
