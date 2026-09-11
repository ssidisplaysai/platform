import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignGeographicMap } from "../CampaignGeographicMap";
import { GLW_US_STATE_GEOMETRY } from "../us-state-geometry";
import type { GlwCampaignManagerRecord, GlwCampaignStateCoverage } from "../campaign-manager";

const coverage: GlwCampaignStateCoverage[] = GLW_US_STATE_GEOMETRY.map((state) => ({ code: state.code, name: state.name, state: state.code === "CA" ? "completed" : state.code === "TX" ? "active" : state.code === "TN" ? "incomplete" : "uncovered", campaignIds: state.code === "CA" ? ["campaign-ca"] : [], targetCount: state.code === "CA" ? 10 : 0, completedCount: state.code === "CA" ? 10 : 0, failedCount: state.code === "TN" ? 1 : 0 }));
const record: GlwCampaignManagerRecord = { campaign: { campaignId: "campaign-ca", organizationId: "org-1", siteId: "site-1", productId: "product-1", name: "California Cities", pageType: "city_service", stateCodes: ["CA"], cityTargets: [{ stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" }], pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "active", completedTargetCount: 0, failedTargetCount: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z" }, summary: { total: 10, referenceComplete: 1, queued: 0, running: 0, draftReady: 9, published: 0, failed: 0, skipped: 0 }, displayState: "COMPLETED", completedAt: "2026-09-11T00:00:00.000Z", completedCount: 10, unresolvedCount: 0 };

describe("Campaign geographic reach map", () => {
  it("ships renderable geometry for all 50 states including Alaska and Hawaii", () => {
    expect(GLW_US_STATE_GEOMETRY).toHaveLength(50); expect(GLW_US_STATE_GEOMETRY.find((state) => state.code === "AK")?.path).toMatch(/^M/u); expect(GLW_US_STATE_GEOMETRY.find((state) => state.code === "HI")?.path).toMatch(/^M/u);
  });
  it("renders geographic paths as primary with canonical city detail and a tile fallback", () => {
    const html = renderToStaticMarkup(<CampaignGeographicMap coverage={coverage} records={[{ ...record, proposal: { name: "Texas Cities", originReason: "Next gap" } }]} products={[{ productId: "product-1", name: "Product" }]} productFilter="" selectedStates={[]} selectedState="CA" onProductFilter={jest.fn()} onToggleState={jest.fn()} onSelectState={jest.fn()} onUseSelection={jest.fn()} onSelectStatus={jest.fn()} onClear={jest.fn()} />);
    expect(html).toContain("<svg"); expect((html.match(/<path/g) ?? [])).toHaveLength(50); expect(html).toContain("Alaska: Uncovered"); expect(html).toContain("Hawaii: Uncovered");
    expect(html).toContain("City campaigns"); expect(html).toContain("California Cities"); expect(html).toContain("10/10 complete"); expect(html).toContain("Accessible state details");
  });
});