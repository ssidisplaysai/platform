jest.mock("server-only", () => ({}));

import {
  evaluateGlwResearchContractCompatibility,
} from "../site-enrichment-contract-guard";
import {
  assertGlwResearchMigrationScope,
  previewGlwResearchContractReconciliation,
} from "../site-enrichment-contract-reconciler";
import {
  buildGlwStateServiceResearchPlan,
} from "../site-enrichment-research-planner";
import type {
  GlwSiteEnrichmentRecord,
} from "../site-enrichment-repository";

function plannerInput() {
  return {
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    siteDomain: "leddisplaywarehouse.com",
    productId: "prod-indoor-digital-sphere",
    productTopic: "Indoor Digital Sphere",
    campaignId: "campaign-guard-test",
    stateCode: "CO",
    stateName: "Colorado",
    canonicalPath: "/indoor-digital-sphere/colorado/",
    jobId: "job-colorado",
    wordpressObjectId: "19853",
    upstreamAuthorityDomains: ["ssidisplays.com"],
  } as const;
}

function currentRecord(): GlwSiteEnrichmentRecord {
  const input = plannerInput();
  const planned = buildGlwStateServiceResearchPlan(input);

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
    researchRequirements: planned.researchRequirements,
    plan: planned.emptyPlan,
    qa: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function staleRecord(): GlwSiteEnrichmentRecord {
  const record = currentRecord();
  const productIndex = record.researchRequirements.findIndex(
    (requirement) =>
      requirement.requirementId === "link-internal-product",
  );

  const staleGeographyRequirement = {
    requirementId: "link-internal-geography",
    kind: "internal_link" as const,
    label: "Internal geography link",
    description: "Legacy state-service geography requirement.",
    required: true,
    sourceTier: null,
    minimumCount: 1,
    fulfilledSourceIds: [],
    fulfilledLinkIds: [],
  };

  return {
    ...record,
    researchRequirements: [
      ...record.researchRequirements.slice(0, productIndex + 1),
      staleGeographyRequirement,
      ...record.researchRequirements.slice(productIndex + 1),
    ],
  };
}

describe("GLW research contract guard", () => {
  it("accepts the certified state-service requirement contract", () => {
    const result = evaluateGlwResearchContractCompatibility(
      currentRecord(),
    );

    expect(result.compatible).toBe(true);
    expect(result.missingRequirementIds).toEqual([]);
    expect(result.obsoleteRequirementIds).toEqual([]);
  });

  it("detects the exact stale geography requirement from the Colorado incident", () => {
    const result = evaluateGlwResearchContractCompatibility(
      staleRecord(),
    );

    expect(result.compatible).toBe(false);
    expect(result.obsoleteRequirementIds).toEqual([
      "link-internal-geography",
    ]);
  });

  it("previews deterministic reconciliation without changing the record", () => {
    const record = staleRecord();
    const before = JSON.stringify(record);

    const preview = previewGlwResearchContractReconciliation({
      record,
      plannerInput: plannerInput(),
    });

    expect(preview.changed).toBe(true);
    expect(preview.requirementsBefore).toBe(8);
    expect(preview.requirementsAfter).toBe(7);
    expect(preview.obsoleteRequirementIds).toEqual([
      "link-internal-geography",
    ]);
    expect(
      preview.nextRequirements.some(
        (requirement) =>
          requirement.requirementId
            === "link-internal-geography",
      ),
    ).toBe(false);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("preserves valid fulfillment for requirements that survive reconciliation", () => {
    const record = staleRecord();
    const productRequirement = record.researchRequirements.find(
      (requirement) =>
        requirement.requirementId === "link-internal-product",
    );

    if (!productRequirement) {
      throw new Error("fixture missing product requirement");
    }

    record.researchRequirements = record.researchRequirements.map(
      (requirement) =>
        requirement.requirementId === "link-internal-product"
          ? {
              ...requirement,
              fulfilledLinkIds: ["internal-product"],
            }
          : requirement,
    );

    const preview = previewGlwResearchContractReconciliation({
      record,
      plannerInput: plannerInput(),
    });

    expect(
      preview.nextRequirements.find(
        (requirement) =>
          requirement.requirementId === "link-internal-product",
      )?.fulfilledLinkIds,
    ).toEqual(["internal-product"]);
  });

  it("rejects migration outside the explicitly authorized mutation scope", () => {
    const preview = [
      previewGlwResearchContractReconciliation({
        record: staleRecord(),
        plannerInput: plannerInput(),
      }),
    ];

    expect(() =>
      assertGlwResearchMigrationScope({
        preview,
        authorizedCanonicalPaths: [
          "/indoor-digital-sphere/alaska/",
        ],
      }),
    ).toThrow(/scope violation/i);
  });

  it("accepts a dry-run whose changed paths exactly match authorization", () => {
    const preview = [
      previewGlwResearchContractReconciliation({
        record: staleRecord(),
        plannerInput: plannerInput(),
      }),
    ];

    expect(() =>
      assertGlwResearchMigrationScope({
        preview,
        authorizedCanonicalPaths: [
          "/indoor-digital-sphere/colorado/",
        ],
      }),
    ).not.toThrow();
  });
});
