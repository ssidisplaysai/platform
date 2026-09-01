import "server-only";

import type {
  GlwEnrichmentPlan,
} from "@/modules/glw/site-enrichment-authority";

import type {
  GlwResearchRequirement,
} from "@/modules/glw/site-enrichment-repository";

export type GlwStateServiceResearchPlanInput = {
  organizationId: string;
  siteId: string;
  siteDomain: string;
  productId: string;
  productTopic: string;
  campaignId: string;
  stateCode: string;
  stateName: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
  upstreamAuthorityDomains:
    readonly string[];
};

export type GlwStateServiceResearchPlan = {
  enrichmentId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  campaignId: string;
  stateCode: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
  upstreamAuthorityDomains:
    readonly string[];
  researchRequirements:
    readonly GlwResearchRequirement[];
  emptyPlan: GlwEnrichmentPlan;
};

function slugToken(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildGlwStateServiceResearchPlan(
  input: GlwStateServiceResearchPlanInput,
): GlwStateServiceResearchPlan {
  const stateCode =
    input.stateCode
      .trim()
      .toUpperCase();

  const productToken =
    slugToken(input.productTopic);

  const stateToken =
    slugToken(input.stateName);

  const requirements:
    GlwResearchRequirement[] = [
      {
        requirementId:
          "source-product-first-party",
        kind: "source",
        label:
          "First-party product authority",
        description:
          `Find the authoritative first-party source for ${input.productTopic} specifications, capabilities, and product claims.`,
        required: true,
        sourceTier: "first_party",
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "source-state-government",
        kind: "source",
        label:
          "Official state authority",
        description:
          `Find an official ${input.stateName} government source supporting state-level geographic or institutional facts used by the page.`,
        required: true,
        sourceTier: "government",
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "source-state-tourism",
        kind: "source",
        label:
          "Official tourism authority",
        description:
          `Find an official or recognized ${input.stateName} tourism authority for visitor, venue, destination, or regional context.`,
        required: true,
        sourceTier: "tourism_board",
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "source-reputable-news",
        kind: "source",
        label:
          "Relevant reputable news context",
        description:
          `Find a relevant reputable national or regional news source only when it materially supports current ${input.stateName} commercial, venue, development, tourism, or experiential-display context.`,
        required: false,
        sourceTier: "reputable_news",
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "link-internal-product",
        kind: "internal_link",
        label:
          "Internal product authority link",
        description:
          `Plan a contextual internal link to the primary ${input.productTopic} authority page on the destination site.`,
        required: true,
        sourceTier: null,
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "link-internal-geography",
        kind: "internal_link",
        label:
          "Internal geography link",
        description:
          `Plan a contextual internal link to the relevant ${input.stateName} geography, market, or parent service page.`,
        required: true,
        sourceTier: null,
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
      {
        requirementId:
          "link-external-authority",
        kind: "external_link",
        label:
          "External geographic authority link",
        description:
          `Plan at least one contextual outbound authority link supported by the ${input.stateName} evidence ledger.`,
        required: true,
        sourceTier: "government",
        minimumCount: 1,
        fulfilledSourceIds: [],
        fulfilledLinkIds: [],
      },
    ];

  if (
    input.upstreamAuthorityDomains.length
      > 0
  ) {
    requirements.push({
      requirementId:
        "link-upstream-source-of-truth",
      kind: "upstream_link",
      label:
        "Upstream source-of-truth link",
      description:
        `Plan a contextual source-of-truth link for ${input.productTopic} to one of the configured upstream authority domains.`,
      required: true,
      sourceTier: "first_party",
      minimumCount: 1,
      fulfilledSourceIds: [],
      fulfilledLinkIds: [],
    });
  }

  return {
    enrichmentId:
      `enrichment-${input.campaignId}-${stateCode.toLowerCase()}`,
    organizationId:
      input.organizationId,
    siteId: input.siteId,
    productId: input.productId,
    campaignId: input.campaignId,
    stateCode,
    canonicalPath:
      input.canonicalPath,
    jobId: input.jobId,
    wordpressObjectId:
      input.wordpressObjectId,
    upstreamAuthorityDomains: [
      ...input.upstreamAuthorityDomains,
    ],
    researchRequirements:
      requirements,
    emptyPlan: {
      organizationId:
        input.organizationId,
      siteId: input.siteId,
      siteDomain:
        input.siteDomain,
      canonicalPath:
        input.canonicalPath,
      upstreamAuthorityDomains: [
        ...input.upstreamAuthorityDomains,
      ],
      sources: [],
      claims: [],
      links: [],
    },
  };
}

export function buildGlwResearchQueryHints(
  input: GlwStateServiceResearchPlanInput,
): readonly string[] {
  return [
    `${input.productTopic} official product specifications`,
    `${input.stateName} official government`,
    `${input.stateName} official tourism`,
    `${input.stateName} commercial venues experiential attractions development`,
    `${input.stateName} museums convention centers sports venues tourism`,
    `${input.productTopic} ${input.stateName}`,
  ];
}