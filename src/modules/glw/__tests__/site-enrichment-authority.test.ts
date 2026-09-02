jest.mock("server-only", () => ({}));

import {
  evaluateGlwEnrichmentPlan,
  type GlwEnrichmentPlan,
} from "../site-enrichment-authority";

function validPlan(
  overrides: Partial<GlwEnrichmentPlan> = {},
): GlwEnrichmentPlan {
  return {
    organizationId:
      "led-display-warehouse",
    siteId:
      "site-led-display-warehouse-production",
    siteDomain:
      "leddisplaywarehouse.com",
    canonicalPath:
      "/indoor-digital-sphere/colorado/",
    upstreamAuthorityDomains: [
      "ssidisplays.com",
    ],
    sources: [
      {
        sourceId: "product-source",
        title:
          "Indoor Digital Sphere Product Authority",
        url:
          "https://ssidisplays.com/digital-spheres/",
        domain: "ssidisplays.com",
        tier: "first_party",
        publisher:
          "Screen Solutions International",
        retrievedAt:
          "2026-09-01T00:00:00.000Z",
      },
      {
        sourceId: "state-source",
        title:
          "Colorado Official Information",
        url:
          "https://www.colorado.gov/",
        domain: "colorado.gov",
        tier: "government",
        publisher:
          "State of Colorado",
        retrievedAt:
          "2026-09-01T00:00:00.000Z",
      },
      {
        sourceId: "tourism-source",
        title:
          "Colorado Tourism Information",
        url:
          "https://www.colorado.com/",
        domain: "colorado.com",
        tier: "tourism_board",
        publisher:
          "Colorado Tourism Office",
        retrievedAt:
          "2026-09-01T00:00:00.000Z",
      },
    ],
    claims: [
      {
        claimId: "product-claim",
        claimClass: "product",
        statement:
          "Indoor digital spheres are available as commercial display systems.",
        evidenceSourceIds: [
          "product-source",
        ],
      },
      {
        claimId: "geography-claim",
        claimClass: "geography",
        statement:
          "Colorado contains major visitor and commercial markets.",
        evidenceSourceIds: [
          "state-source",
          "tourism-source",
        ],
      },
    ],
    links: [
      {
        linkId: "internal-product",
        kind: "internal",
        href:
          "/indoor-digital-sphere/",
        anchorText:
          "Indoor Digital Sphere",
      },
      {
        linkId: "external-state",
        kind: "external_authority",
        href:
          "https://www.colorado.gov/",
        anchorText:
          "State of Colorado",
        sourceId: "state-source",
      },
      {
        linkId: "upstream-ssi",
        kind:
          "upstream_source_of_truth",
        href:
          "https://ssidisplays.com/digital-spheres/",
        anchorText:
          "Digital Sphere technical source",
        sourceId: "product-source",
      },
    ],
    ...overrides,
  };
}

describe(
  "Genesis Site Studio enrichment authority",
  () => {
    test(
      "passes a fully evidenced authority and link plan",
      () => {
        const result =
          evaluateGlwEnrichmentPlan(
            validPlan(),
          );

        expect(result.ok).toBe(true);
        expect(result.status).toBe(
          "enriched",
        );
        expect(
          result.publicationReadyEligible,
        ).toBe(true);
        expect(
          result.checks.internalLinks.ok,
        ).toBe(true);
      },
    );

    test(
      "fails closed when a claim has no evidence",
      () => {
        const plan = validPlan({
          claims: [
            {
              claimId:
                "unsupported-claim",
              claimClass: "context",
              statement:
                "Unsupported statement.",
              evidenceSourceIds: [],
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(result.ok).toBe(false);
        expect(result.status).toBe(
          "qa_failed",
        );
        expect(
          result.checks.claimEvidence.ok,
        ).toBe(false);
      },
    );

    test(
      "requires first-party authority for product claims",
      () => {
        const plan = validPlan({
          claims: [
            {
              claimId:
                "product-with-wrong-source",
              claimClass: "product",
              statement:
                "Product specification.",
              evidenceSourceIds: [
                "state-source",
              ],
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks.productAuthority.ok,
        ).toBe(false);
      },
    );

    test(
      "requires qualified authority for geographic claims",
      () => {
        const plan = validPlan({
          claims: [
            {
              claimId:
                "geo-with-product-source",
              claimClass:
                "geography",
              statement:
                "Colorado market claim.",
              evidenceSourceIds: [
                "product-source",
              ],
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks
            .geographicAuthority.ok,
        ).toBe(false);
      },
    );

    test(
      "requires at least one internal link",
      () => {
        const plan = validPlan({
          links:
            validPlan().links.filter(
              (link) =>
                link.kind !== "internal",
            ),
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks.internalLinks.ok,
        ).toBe(false);
      },
    );

    test(
      "rejects malformed internal links",
      () => {
        const plan = validPlan({
          links: [
            ...validPlan().links.filter(
              (link) => link.kind !== "internal",
            ),
            {
              linkId: "malformed-internal",
              kind: "internal",
              href: "//example.com/not-internal",
              anchorText: "Malformed",
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(plan);

        expect(
          result.checks.internalLinks.ok,
        ).toBe(false);
      },
    );

    test(
      "requires an external authority link",
      () => {
        const plan = validPlan({
          links:
            validPlan().links.filter(
              (link) =>
                link.kind
                !== "external_authority",
            ),
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks
            .externalAuthorityLinks.ok,
        ).toBe(false);
      },
    );

    test(
      "requires configured upstream source-of-truth linking",
      () => {
        const plan = validPlan({
          links:
            validPlan().links.filter(
              (link) =>
                link.kind
                !==
                "upstream_source_of_truth",
            ),
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks
            .upstreamAuthorityLinks.ok,
        ).toBe(false);
      },
    );

    test(
      "does not require upstream linking when no upstream authority is configured",
      () => {
        const plan = validPlan({
          upstreamAuthorityDomains: [],
          links:
            validPlan().links.filter(
              (link) =>
                link.kind
                !==
                "upstream_source_of_truth",
            ),
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks
            .upstreamAuthorityLinks.ok,
        ).toBe(true);
      },
    );

    test(
      "fails external links that do not resolve to stored evidence",
      () => {
        const plan = validPlan({
          links: [
            ...validPlan().links,
            {
              linkId:
                "untracked-news-link",
              kind:
                "external_authority",
              href:
                "https://example.com/news/",
              anchorText:
                "Example news",
              sourceId:
                "missing-source",
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks
            .linkSourceIntegrity.ok,
        ).toBe(false);
      },
    );

    test(
      "rejects source records whose declared domain does not match the URL",
      () => {
        const plan = validPlan({
          sources: [
            ...validPlan().sources,
            {
              sourceId:
                "spoofed-source",
              title:
                "Spoofed Source",
              url:
                "https://example.com/",
              domain:
                "colorado.gov",
              tier: "government",
              publisher:
                "Unknown",
              retrievedAt:
                "2026-09-01T00:00:00.000Z",
            },
          ],
        });

        const result =
          evaluateGlwEnrichmentPlan(
            plan,
          );

        expect(
          result.checks.sourceUrls.ok,
        ).toBe(false);
      },
    );
  },
);
