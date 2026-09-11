import { NextRequest } from "next/server";

const createGlwCampaign = jest.fn();
const listGlwCampaigns = jest.fn();
jest.mock("@/modules/foundation/product-repository", () => ({ getProductById: () => ({ productId: "product-1", organizationId: "org-1", assignedSiteIds: ["site-1"] }) }));
jest.mock("@/modules/foundation/site-repository", () => ({ getSiteById: () => ({ siteId: "site-1", organizationId: "org-1" }) }));
jest.mock("@/modules/glw/campaign-repository", () => ({ createGlwCampaign: (input: unknown) => createGlwCampaign(input), listGlwCampaigns: () => listGlwCampaigns() }));
jest.mock("@/modules/glw/page-generation", () => ({ GLW_CITIES: [{ stateCode: "CA", name: "Los Angeles", slug: "los-angeles" }] }));

import { POST } from "../route";

describe("campaign draft route", () => {
  beforeEach(() => { createGlwCampaign.mockReset(); listGlwCampaigns.mockReset(); listGlwCampaigns.mockReturnValue([{ campaignId: "campaign-parent", organizationId: "org-1", siteId: "site-1", productId: "product-1" }]); });
  it("creates only an explicit lineage-bearing draft and performs no activation or publication", async () => {
    createGlwCampaign.mockImplementation((input) => ({ campaign: { ...input, campaignId: "draft-1", status: "draft" }, errors: [] }));
    const request = new NextRequest("http://localhost/api/glw/campaign-drafts", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "org-1", "x-gcp-site-id": "site-1" }, body: JSON.stringify({ siteId: "site-1", productId: "product-1", name: "California Cities", pageType: "city_service", stateCodes: ["CA"], pagesPerDay: 10, publicationPolicy: "draft_only", parentCampaignId: "campaign-parent", originReason: "Completed state coverage." }) });
    const response = await POST(request); const payload = await response.json();
    expect(response.status).toBe(201); expect(payload).toMatchObject({ campaign: { status: "draft", parentCampaignId: "campaign-parent" }, activationPerformed: false, targetsCreated: 0, publicationPerformed: false });
    expect(createGlwCampaign).toHaveBeenCalledWith(expect.objectContaining({ parentCampaignId: "campaign-parent", cityTargets: [{ stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" }] }));
  });
  it("enforces organization and site isolation before repository mutation", async () => {
    const request = new NextRequest("http://localhost/api/glw/campaign-drafts", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": "other-org", "x-gcp-site-id": "site-1" }, body: JSON.stringify({ siteId: "site-1", productId: "product-1", name: "Blocked", pageType: "state_service", stateCodes: ["CA"] }) });
    const response = await POST(request); expect(response.status).toBe(403); expect(createGlwCampaign).not.toHaveBeenCalled();
  });
  it("rejects lineage to a campaign outside the same authority boundary", async () => {
    listGlwCampaigns.mockReturnValue([{ campaignId: "foreign-parent", organizationId: "org-2", siteId: "site-2", productId: "product-1" }]);
    const request = new NextRequest("http://localhost/api/glw/campaign-drafts", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "org-1", "x-gcp-site-id": "site-1" }, body: JSON.stringify({ siteId: "site-1", productId: "product-1", name: "Blocked lineage", pageType: "state_service", stateCodes: ["CA"], parentCampaignId: "foreign-parent" }) });
    const response = await POST(request); expect(response.status).toBe(403); expect(createGlwCampaign).not.toHaveBeenCalled();
  });
});