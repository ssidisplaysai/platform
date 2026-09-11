jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const site = { siteId: "site-rj", organizationId: "rj-metal", displayName: "Commercial Stainless Counters" };
const snapshot = { strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "cap", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" };
const certification = { certificationId: "cert-1", revision: 1, ...site, certifiedAt: "now", certifiedBy: "owner", ...snapshot };
const readiness = { readyToCertify: true, blockers: [], snapshot };
const certifyGenerationReadiness = jest.fn(() => certification);
const startSiteBuild = jest.fn(() => ({ buildSessionId: "build-1", organizationId: site.organizationId, siteId: site.siteId, certificationId: certification.certificationId, state: "STARTED", startedAt: "now", startedBy: "owner" }));
const getSiteGenerationReadiness = jest.fn(() => ({ readiness, certification: { status: "NOT_CERTIFIED", certification: null }, buildSession: null, authority: {} }));

jest.mock("../site-repository", () => ({ getSiteById: jest.fn((siteId: string) => siteId === site.siteId ? site : null) }));
jest.mock("../site-generation-readiness-service", () => ({ getSiteGenerationReadiness: (...args: unknown[]) => getSiteGenerationReadiness(...args) }));
jest.mock("../site-generation-readiness-repository", () => ({ certifyGenerationReadiness: (...args: unknown[]) => certifyGenerationReadiness(...args), startSiteBuild: (...args: unknown[]) => startSiteBuild(...args) }));

import { GET, POST } from "@/app/api/sites/[siteId]/generation-readiness/route";
import { POST as startBuild } from "@/app/api/sites/[siteId]/site-build/route";

function request(path: string, init?: RequestInit) { return new NextRequest(`http://localhost${path}`, init); }
const context = { params: Promise.resolve({ siteId: site.siteId }) };
const headers = { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": site.organizationId, "x-gcp-site-id": site.siteId };

describe("Generation Readiness API", () => {
  beforeEach(() => { jest.clearAllMocks(); getSiteGenerationReadiness.mockReturnValue({ readiness, certification: { status: "NOT_CERTIFIED", certification: null }, buildSession: null, authority: {} }); });

  test("GET is read-only and viewing does not certify", async () => {
    const response = await GET(request(`/api/sites/${site.siteId}/generation-readiness`, { headers }), context);
    expect(response.status).toBe(200); expect((await response.json()).certificationPerformed).toBe(false); expect(certifyGenerationReadiness).not.toHaveBeenCalled(); expect(startSiteBuild).not.toHaveBeenCalled();
  });

  test("certification requires exact explicit owner confirmation and does not start Site Build", async () => {
    expect((await POST(request(`/api/sites/${site.siteId}/generation-readiness`, { method: "POST", headers, body: "{}" }), context)).status).toBe(400);
    const response = await POST(request(`/api/sites/${site.siteId}/generation-readiness`, { method: "POST", headers, body: JSON.stringify({ confirm: "CERTIFY_GENERATION_READINESS" }) }), context);
    expect(response.status).toBe(200); expect(certifyGenerationReadiness).toHaveBeenCalledTimes(1); expect(startSiteBuild).not.toHaveBeenCalled(); expect(await response.json()).toMatchObject({ certificationPerformed: true, siteBuildStarted: false });
  });

  test("route organization and site isolation rejects stale workspace scope", async () => {
    for (const scopedHeaders of [{ ...headers, "x-gcp-organization-id": "other-org" }, { ...headers, "x-gcp-site-id": "stale-site" }]) expect((await GET(request(`/api/sites/${site.siteId}/generation-readiness`, { headers: scopedHeaders }), context)).status).toBe(404);
  });

  test("Site Build is a separate exact-confirmation action requiring the current certification", async () => {
    expect((await startBuild(request(`/api/sites/${site.siteId}/site-build`, { method: "POST", headers, body: "{}" }), context)).status).toBe(400);
    getSiteGenerationReadiness.mockReturnValue({ readiness, certification: { status: "CURRENT", certification }, buildSession: null, authority: {} });
    const response = await startBuild(request(`/api/sites/${site.siteId}/site-build`, { method: "POST", headers, body: JSON.stringify({ confirm: "START_SITE_BUILD", certificationId: certification.certificationId }) }), context);
    expect(response.status).toBe(200); expect(startSiteBuild).toHaveBeenCalledTimes(1); expect(await response.json()).toMatchObject({ wordpressMutation: false, publicationMutation: false });
  });
});