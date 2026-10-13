jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const site = { siteId: "site-rj", organizationId: "rj-metal" };
const inspect = jest.fn(async () => ({ ready: true, contentUpdateReady: true, authenticated: true, targetCount: 15, existingReceiptCount: 15, absentCount: 0, blockedTargets: [], wordpressMutationPerformed: false, publicationMutationPerformed: false }));

jest.mock("../site-repository", () => ({ getSiteById: jest.fn((siteId: string) => siteId === site.siteId ? site : null) }));
jest.mock("../site-build-service", () => ({ inspectSiteBuildWordPressReadiness: (...args: unknown[]) => inspect(...args) }));

import { GET } from "@/app/api/sites/[siteId]/site-build/wordpress-readiness/route";

const context = { params: Promise.resolve({ siteId: site.siteId }) };
function request(organizationId = site.organizationId, siteId = site.siteId) { return new NextRequest(`http://localhost/api/sites/${site.siteId}/site-build/wordpress-readiness`, { headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": organizationId, "x-gcp-site-id": siteId } }); }

describe("WordPress content update readiness API", () => {
  beforeEach(() => inspect.mockClear());

  test("is read-only and preserves exact resolved receipt counts", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ validationReadOnly: true, readiness: { contentUpdateReady: true, targetCount: 15, existingReceiptCount: 15, absentCount: 0, wordpressMutationPerformed: false, publicationMutationPerformed: false } });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  test("enforces organization and site isolation before inspection", async () => {
    expect((await GET(request("other"), context)).status).toBe(404);
    expect((await GET(request(site.organizationId, "other"), context)).status).toBe(404);
    expect(inspect).not.toHaveBeenCalled();
  });
});