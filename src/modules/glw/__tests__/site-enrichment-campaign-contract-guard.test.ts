jest.mock("server-only", () => ({}));

import {
  assertGlwCampaignResearchMigrationScope,
  buildGlwCampaignResearchContractDryRun,
} from "../site-enrichment-campaign-contract-guard";
import {
  buildGlwStateServiceResearchPlan,
  type GlwStateServiceResearchPlanInput,
} from "../site-enrichment-research-planner";
import type {
  GlwSiteEnrichmentRecord,
} from "../site-enrichment-repository";

const states = [
  ["AK", "Alaska", "alaska", "19829"],
  ["AL", "Alabama", "alabama", "19825"],
  ["AR", "Arkansas", "arkansas", "19837"],
] as const;

function plannerInput(
  state: typeof states[number],
): GlwStateServiceResearchPlanInput {
  const [stateCode, stateName, slug, wordpressObjectId] = state;
  return {
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    siteDomain: "leddisplaywarehouse.com",
    productId: "prod-indoor-digital-sphere",
    productTopic: "Indoor Digital Sphere",
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-indoor-led-sphere-50-states",
    stateCode,
    stateName,
    canonicalPath: `/indoor-digital-sphere/${slug}/`,
    jobId: `job-${stateCode.toLowerCase()}`,
    wordpressObjectId,
    upstreamAuthorityDomains: ["ssidisplays.com"],
  };
}

function recordFor(
  state: typeof states[number],
  stale: boolean,
): GlwSiteEnrichmentRecord {
  const input = plannerInput(state);
  const planned = buildGlwStateServiceResearchPlan(input);
  const requirements = stale
    ? [
        ...planned.researchRequirements,
        {
          requirementId: "link-internal-geography",
          kind: "internal_link" as const,
          label: "Legacy geography",
          description: "Obsolete state-service requirement",
          required: true,
          sourceTier: null,
          minimumCount: 1,
          fulfilledSourceIds: [],
          fulfilledLinkIds: [],
        },
      ]
    : planned.researchRequirements;

  return {
    enrichmentId: planned.enrichmentId,
    organizationId: planned.organizationId,
    siteId: planned.siteId,
    productId: planned.productId,
    campaignId: planned.campaignId,
    stateCode: planned.stateCode,
    pageType: "state_service",
    canonicalPath: planned.canonicalPath,
    jobId: planned.jobId,
    wordpressObjectId: planned.wordpressObjectId,
    upstreamAuthorityDomains: planned.upstreamAuthorityDomains,
    status: "research_pending",
    researchRequirements: requirements,
    plan: planned.emptyPlan,
    qa: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("GLW campaign research contract guard", () => {
  it("reports stale records deterministically without mutation", () => {
    const records = [
      recordFor(states[0], true),
      recordFor(states[1], true),
      recordFor(states[2], false),
    ];
    const before = JSON.stringify(records);
    const inputs = new Map(
      states.map((state) => [state[0], plannerInput(state)]),
    );

    const dryRun = buildGlwCampaignResearchContractDryRun({
      records,
      plannerInputForRecord: (record) => {
        const value = inputs.get(record.stateCode);
        if (!value) throw new Error("missing planner input");
        return value;
      },
    });

    expect(dryRun.totalRecords).toBe(3);
    expect(dryRun.compatibleRecords).toBe(1);
    expect(dryRun.incompatibleRecords).toBe(2);
    expect(dryRun.changedRecords).toBe(2);
    expect(dryRun.providerInvocationAllowed).toBe(false);
    expect(dryRun.changedCanonicalPaths).toEqual([
      "/indoor-digital-sphere/alabama/",
      "/indoor-digital-sphere/alaska/",
    ]);
    expect(JSON.stringify(records)).toBe(before);
  });

  it("accepts only the exact authorized changed-record set", () => {
    const records = [
      recordFor(states[0], true),
      recordFor(states[1], true),
      recordFor(states[2], false),
    ];
    const inputs = new Map(
      states.map((state) => [state[0], plannerInput(state)]),
    );
    const dryRun = buildGlwCampaignResearchContractDryRun({
      records,
      plannerInputForRecord: (record) => inputs.get(record.stateCode)!,
    });

    expect(() =>
      assertGlwCampaignResearchMigrationScope({
        dryRun,
        authorizedCanonicalPaths: [
          "/indoor-digital-sphere/alaska/",
          "/indoor-digital-sphere/alabama/",
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertGlwCampaignResearchMigrationScope({
        dryRun,
        authorizedCanonicalPaths: [
          "/indoor-digital-sphere/alaska/",
        ],
      }),
    ).toThrow(/scope violation/i);
  });

  it("refuses mixed campaign input", () => {
    const first = recordFor(states[0], false);
    const second = {
      ...recordFor(states[1], false),
      campaignId: "different-campaign",
    };

    expect(() =>
      buildGlwCampaignResearchContractDryRun({
        records: [first, second],
        plannerInputForRecord: () => plannerInput(states[0]),
      }),
    ).toThrow(/mix campaigns or sites/i);
  });
});
