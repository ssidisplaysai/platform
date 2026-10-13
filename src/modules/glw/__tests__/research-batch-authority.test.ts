jest.mock("server-only", () => ({}));

import {
  GLW_RESEARCH_BATCH_CAMPAIGN_ID,
  GLW_RESEARCH_BATCH_CONFIRMATION,
  GLW_RESEARCH_BATCH_ORGANIZATION_ID,
  GLW_RESEARCH_BATCH_PRODUCT_ID,
  GLW_RESEARCH_BATCH_SITE_ID,
  validateGlwResearchBatch,
} from "@/modules/glw/research-batch-authority";
import type { GlwSiteEnrichmentRecord } from "@/modules/glw/site-enrichment-repository";

function record(stateCode = "AK"): GlwSiteEnrichmentRecord {
  const slug = stateCode === "AK" ? "alaska" : "colorado";
  return {
    enrichmentId: `enrichment-${stateCode}`,
    organizationId: GLW_RESEARCH_BATCH_ORGANIZATION_ID,
    siteId: GLW_RESEARCH_BATCH_SITE_ID,
    productId: GLW_RESEARCH_BATCH_PRODUCT_ID,
    campaignId: GLW_RESEARCH_BATCH_CAMPAIGN_ID,
    stateCode,
    pageType: "state_service",
    canonicalPath: `/indoor-digital-sphere/${slug}/`,
    jobId: `job-${stateCode}`,
    wordpressObjectId: stateCode === "AK" ? "19829" : "19853",
    upstreamAuthorityDomains: ["ssidisplays.com"],
    status: stateCode === "AK" ? "research_pending" : "research_ready",
    researchRequirements: [
      ["source-product-first-party", "source", true, "first_party"],
      ["source-state-government", "source", true, "government"],
      ["source-state-tourism", "source", true, "tourism_board"],
      ["source-reputable-news", "source", false, "reputable_news"],
      ["link-internal-product", "internal_link", true, null],
      ["link-external-authority", "external_link", true, "government"],
      ["link-upstream-source-of-truth", "upstream_link", true, "first_party"],
    ].map(([requirementId, kind, required, sourceTier]) => ({
      requirementId: String(requirementId),
      kind: kind as "source" | "internal_link" | "external_link" | "upstream_link",
      label: String(requirementId),
      description: String(requirementId),
      required: Boolean(required),
      sourceTier: sourceTier as never,
      minimumCount: 1,
      fulfilledSourceIds: [],
      fulfilledLinkIds: [],
    })),
    plan: {
      organizationId: GLW_RESEARCH_BATCH_ORGANIZATION_ID,
      siteId: GLW_RESEARCH_BATCH_SITE_ID,
      siteDomain: "leddisplaywarehouse.com",
      canonicalPath: `/indoor-digital-sphere/${slug}/`,
      upstreamAuthorityDomains: ["ssidisplays.com"],
      sources: [], claims: [], links: [],
    },
    qa: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function request(item: GlwSiteEnrichmentRecord) {
  return {
    organizationId: item.organizationId,
    siteId: item.siteId,
    campaignId: item.campaignId,
    productId: item.productId,
    stateCode: item.stateCode,
    canonicalPath: item.canonicalPath,
    jobId: item.jobId,
    wordpressObjectId: item.wordpressObjectId,
  };
}

describe("GLW bounded research batch authority", () => {
  it("accepts an exact compatible authorized pending identity", () => {
    const ak = record();
    expect(validateGlwResearchBatch({
      envelope: { confirm: GLW_RESEARCH_BATCH_CONFIRMATION, requests: [request(ak)] },
      records: [ak],
    })).toHaveLength(1);
  });

  it("rejects Colorado even when persisted", () => {
    const co = record("CO");
    expect(() => validateGlwResearchBatch({
      envelope: { confirm: GLW_RESEARCH_BATCH_CONFIRMATION, requests: [request(co)] },
      records: [co],
    })).toThrow("Colorado is excluded");
  });

  it("rejects duplicates", () => {
    const ak = record();
    expect(() => validateGlwResearchBatch({
      envelope: { confirm: GLW_RESEARCH_BATCH_CONFIRMATION, requests: [request(ak), request(ak)] },
      records: [ak],
    })).toThrow("duplicate");
  });

  it("rejects a non-pending record", () => {
    const ak = { ...record(), status: "research_ready" as const };
    expect(() => validateGlwResearchBatch({
      envelope: { confirm: GLW_RESEARCH_BATCH_CONFIRMATION, requests: [request(ak)] },
      records: [ak],
    })).toThrow("research_pending");
  });

  it("rejects stale contract before provider eligibility", () => {
    const ak = record();
    const stale = {
      ...ak,
      researchRequirements: [
        ...ak.researchRequirements,
        { requirementId: "link-internal-geography", kind: "internal_link" as const, label: "stale", description: "stale", required: true, sourceTier: null, minimumCount: 1, fulfilledSourceIds: [], fulfilledLinkIds: [] },
      ],
    };
    expect(() => validateGlwResearchBatch({
      envelope: { confirm: GLW_RESEARCH_BATCH_CONFIRMATION, requests: [request(stale)] },
      records: [stale],
    })).toThrow("contract is incompatible");
  });
});
