jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const mockSite = { siteId: "site-rj", organizationId: "rj-metal", displayName: "Commercial Stainless Counters" };
const mockWorkspace = { site: mockSite, session: { buildSessionId: "build-1" }, stage: "BUILD_PLAN", next: { action: "GENERATE_BUILD_PLAN" } };
const mockGetSiteBuildWorkspace = jest.fn(() => mockWorkspace);
const mockGenerateBuildPlan = jest.fn();
const mockCreateBuildWordPressDrafts = jest.fn(async () => []);
const mockGetSiteGenerationReadiness = jest.fn(() => ({ certification: { status: "CURRENT", certification: { certificationId: "cert-1" } } }));

jest.mock("../site-repository", () => ({ getSiteById: jest.fn((siteId: string) => siteId === mockSite.siteId ? mockSite : null) }));
jest.mock("../site-build-service", () => ({ getSiteBuildWorkspace: (...args: unknown[]) => mockGetSiteBuildWorkspace(...args), generateBuildPlan: (...args: unknown[]) => mockGenerateBuildPlan(...args), reviseBuildPlan: jest.fn(), approveBuildPlan: jest.fn(), rejectBuildPlan: jest.fn(), generateBuildDrafts: jest.fn(), approveBuildDrafts: jest.fn(), createBuildWordPressDrafts: (...args: unknown[]) => mockCreateBuildWordPressDrafts(...args) }));
jest.mock("../site-generation-readiness-service", () => ({ getSiteGenerationReadiness: (...args: unknown[]) => mockGetSiteGenerationReadiness(...args) }));
jest.mock("../site-generation-readiness-repository", () => ({ startSiteBuild: jest.fn() }));

import { GET, POST } from "@/app/api/sites/[siteId]/site-build/route";

const context = { params: Promise.resolve({ siteId: mockSite.siteId }) };
const headers = { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": mockSite.organizationId, "x-gcp-site-id": mockSite.siteId };
function request(init?: RequestInit) { return new NextRequest(`http://localhost/api/sites/${mockSite.siteId}/site-build`, init); }

describe("bounded Site Build API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("GET is read-only and enforces organization/site route scope", async () => {
    const response = await GET(request({ headers }), context);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ mutationPerformed: false, workspace: { stage: "BUILD_PLAN" } });
    expect(mockGenerateBuildPlan).not.toHaveBeenCalled(); expect(mockCreateBuildWordPressDrafts).not.toHaveBeenCalled();
    for (const bad of [{ ...headers, "x-gcp-organization-id": "other" }, { ...headers, "x-gcp-site-id": "other" }]) expect((await GET(request({ headers: bad }), context)).status).toBe(404);
  });

  test("build-plan generation is proposal-only and cannot contact WordPress", async () => {
    const response = await POST(request({ method: "POST", headers, body: JSON.stringify({ confirm: "GENERATE_BUILD_PLAN" }) }), context);
    expect(response.status).toBe(200); expect(mockGenerateBuildPlan).toHaveBeenCalledTimes(1); expect(mockCreateBuildWordPressDrafts).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ wordpressMutation: false, publicationMutation: false, siteEnabledMutation: false });
  });

  test("WordPress draft creation is a separate exact owner action", async () => {
    expect((await POST(request({ method: "POST", headers, body: "{}" }), context)).status).toBe(400);
    const response = await POST(request({ method: "POST", headers, body: JSON.stringify({ confirm: "CREATE_WORDPRESS_DRAFTS" }) }), context);
    expect(response.status).toBe(200); expect(mockCreateBuildWordPressDrafts).toHaveBeenCalledTimes(1); expect(await response.json()).toMatchObject({ wordpressMutation: true, publicationMutation: false });
  });
});