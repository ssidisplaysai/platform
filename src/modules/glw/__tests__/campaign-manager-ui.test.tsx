import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignManager } from "../CampaignManager";
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
    const html = renderToStaticMarkup(<CampaignManager organizationId="org-1" siteId="site-1" requestRoles={["ops_manager"]} records={[{ ...record, proposal: { parentCampaignId: "campaign-1", originReason: "Expand completed state coverage.", name: "Indoor LED Sphere Major Cities", productId: "product-1", pageType: "city_service", stateCodes: ["CA"], pagesPerDay: 10, publicationPolicy: "draft_only" } }]} coverage={coverage} products={[{ productId: "product-1", name: "Indoor LED Sphere" }]} productNames={{ "product-1": "Indoor LED Sphere" }} />);
    expect(html).toContain("COMPLETED"); expect(html).toMatch(/Completed Sep (10|11), 2026/u); expect(html).toContain("0<"); expect(html).toContain("Failed");
    expect(html).toContain("Next Campaign"); expect(html).toContain("Start from this"); expect(html).toContain("United States campaign coverage map");
    expect(html).toContain("Step 1 of 6"); expect(html).toContain("What are we expanding?"); expect(html).not.toContain("Launch Campaign");
  });
});