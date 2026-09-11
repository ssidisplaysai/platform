import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignManager } from "../CampaignManager";
import { CampaignLocalReferenceReview } from "../CampaignLocalReferenceReview";
import type { GlwCampaignManagerRecord, GlwCampaignStateCoverage } from "../campaign-manager";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const record: GlwCampaignManagerRecord = {
  campaign: { campaignId: "campaign-1", organizationId: "org-1", siteId: "site-1", productId: "product-1", name: "Indoor LED Sphere 50 States", pageType: "state_service", stateCodes: ["CA"], pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "active", completedTargetCount: 0, failedTargetCount: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z" },
  summary: { total: 1, referenceComplete: 0, queued: 0, running: 0, draftReady: 0, published: 1, failed: 0, skipped: 0 },
  displayState: "COMPLETED", completedAt: "2026-09-11T00:00:00.000Z", completedCount: 1, unresolvedCount: 0,
};
const coverage: GlwCampaignStateCoverage[] = [{ code: "CA", name: "California", state: "completed", campaignIds: ["campaign-1"], targetCount: 1, completedCount: 1, failedCount: 0 }, { code: "TX", name: "Texas", state: "uncovered", campaignIds: [], targetCount: 0, completedCount: 0, failedCount: 0 }];

describe("Campaign Manager UI", () => {
  it("renders terminal state, coverage map, continuation, and progressive draft builder", () => {
    const html = renderToStaticMarkup(<CampaignManager organizationId="org-1" siteId="site-1" requestRoles={["ops_manager"]} records={[{ ...record, proposal: { parentCampaignId: "campaign-1", originReason: "Expand completed state coverage.", name: "Indoor LED Sphere Major Cities", productId: "product-1", pageType: "city_service", stateCodes: ["CA"], pagesPerDay: 10, publicationPolicy: "draft_only" } }]} coverage={coverage} coverageByProduct={{ "product-1": coverage }} products={[{ productId: "product-1", name: "Indoor LED Sphere" }]} productNames={{ "product-1": "Indoor LED Sphere" }} />);
    expect(html).toContain("COMPLETED"); expect(html).toMatch(/Completed Sep (10|11), 2026/u); expect(html).toContain("0<"); expect(html).toContain("Failed");
    expect(html).toContain("Next Campaign"); expect(html).toContain("Start from this"); expect(html).toContain("Geographic United States campaign coverage map");
    expect(html).toContain("Step 1 of 6"); expect(html).toContain("What are we expanding?"); expect(html).not.toContain("Launch Campaign");
  });

  it("shows exact activation prerequisites and campaign-scoped owner language", () => {
    const prepared = {
      ...record,
      campaign: { ...record.campaign, status: "draft" as const, pageType: "city_service" as const },
      summary: { ...record.summary, prepared: 4, total: 4, published: 0 },
      displayState: "DRAFT" as const,
      completedAt: null,
      completedCount: 0,
      unresolvedCount: 4,
    };
    const html = renderToStaticMarkup(<CampaignManager organizationId="org-1" siteId="site-1" requestRoles={["platform_admin"]} records={[{ ...prepared, proposal: null }]} coverage={coverage} coverageByProduct={{ "product-1": coverage }} products={[{ productId: "product-1", name: "Projector Enclosure" }]} productNames={{ "product-1": "Projector Enclosure" }} activationReadinessByCampaign={{ "campaign-1": { knowledgePackReady: false, approvedReferenceCount: 0, preparedTargetCount: 4, grantActive: false, grantStatus: "NONE", grantExpiresAt: null, targetFingerprint: "fingerprint", certifiedReleaseSha: null, referenceStateCode: null, referenceCitySlug: null } }} globalPromotionAvailable={false} globalPromotionReason="Campaign Launch is not enabled for this production release." />);
    expect(html).toContain("Ready except for:");
    expect(html).toContain("Campaign knowledge pack");
    expect(html).toContain("Approved campaign reference");
    expect(html).toContain("Scoped activation authorization");
    expect(html).toContain("Campaign prepared");
    expect(html).toContain("Reference review");
    expect(html).toContain("Authorize This Campaign for Activation");
    expect(html).toContain("This authorization applies only to this campaign and does not enable publishing or other campaigns.");
    expect(html).toContain("Advanced Details");
    expect(html).not.toContain("nonce");
  });

  it("renders the Genesis-local reference review and all explicit owner actions", () => {
    const html = renderToStaticMarkup(<CampaignLocalReferenceReview organizationId="ssi" siteId="site-ssi-projectorenclosure" campaignId="campaign-1" requestRoles={["platform_admin"]} reference={{
      referenceDraftId: "local-reference-1", campaignId: "campaign-1", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "product-1",
      stateCode: "TX", citySlug: "austin", cityName: "Austin", canonicalPath: "fan-cooled-projector-enclosures/texas/austin", revision: 1,
      status: "READY_FOR_OWNER_REVIEW", title: "Fan Cooled Projector Enclosures in Austin, Texas", seoTitle: "Fan Cooled Projector Enclosures in Austin, TX",
      metaDescription: "Plan a fan-cooled projector enclosure for an Austin commercial AV installation.", h1: "Fan Cooled Projector Enclosures in Austin, Texas",
      excerpt: "Austin planning guidance.", sections: [{ heading: "Plan projector protection", bodyHtml: "<p>Approved local review copy.</p>" }],
      internalLinks: [{ label: "fan-cooled overview", url: "https://projectorenclosure.com/fan-cooled-projector-enclosures/" }],
      image: { required: true, status: "OWNER_ASSET_CANDIDATE", assetReference: "wordpress-media:10757", classification: "OWNER_ASSET", altText: "Fan-cooled enclosure", ownerApproved: false },
      provenance: { parentCampaignId: "parent", knowledgePackRevision: 1, authorityReferences: ["product:product-1"] }, reviewInstructions: null,
      createdAt: "2030-01-01", updatedAt: "2030-01-01",
    }} />);
    expect(html).toContain("READY FOR OWNER REVIEW");
    expect(html).toContain("Genesis local · not published");
    expect(html).toContain("Approve Reference");
    expect(html).toContain("Request Changes");
    expect(html).toContain("Regenerate");
    expect(html).toContain("Regenerate With Instructions");
    expect(html).toContain("Generate Image");
    expect(html).toContain("Replace With Owner Asset");
    expect(html).toContain("Advanced provenance");
    expect(html).toContain("does not approve the canonical WordPress reference");
  });
});