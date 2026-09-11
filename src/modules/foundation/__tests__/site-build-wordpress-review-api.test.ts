jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const site = { siteId: "site-rj", organizationId: "rj-metal" };
const inspect = jest.fn(async () => ({ readOnly: true, items: Array.from({ length: 15 }), summary: { verifiedDraftCount: 15, publishedCount: 0 }, media: { mediaSyncStillRequired: true }, qa: { navigationStatus: "REVIEW_ONLY" } }));
jest.mock("../site-repository", () => ({ getSiteById: jest.fn((siteId: string) => siteId === site.siteId ? site : null) }));
jest.mock("../site-build-wordpress-review", () => ({ inspectSiteBuildWordPressDrafts: (...args: unknown[]) => inspect(...args) }));

import { GET } from "@/app/api/sites/[siteId]/site-build/wordpress-review/route";

const context = { params: Promise.resolve({ siteId: site.siteId }) };
function request(organizationId = site.organizationId, siteId = site.siteId) { return new NextRequest(`http://localhost/api/sites/${site.siteId}/site-build/wordpress-review`, { headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": organizationId, "x-gcp-site-id": siteId } }); }

describe("WordPress draft review API", () => {
  beforeEach(() => inspect.mockClear());
  test("returns authenticated read-only verification without mutation", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ review: { readOnly: true, summary: { verifiedDraftCount: 15, publishedCount: 0 } }, mutationPerformed: false, publicationMutation: false });
    expect(inspect).toHaveBeenCalledTimes(1);
  });
  test("enforces organization and site isolation", async () => {
    expect((await GET(request("other"), context)).status).toBe(404);
    expect((await GET(request(site.organizationId, "other"), context)).status).toBe(404);
    expect(inspect).not.toHaveBeenCalled();
  });
});