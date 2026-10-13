import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/governed-render-capture-orchestrator", () => ({ resolveSiteHomeCaptureAuthority: jest.fn(), runGovernedRenderCapture: jest.fn() }));
import { resolveSiteHomeCaptureAuthority } from "@/modules/foundation/governed-render-capture-orchestrator";
import { POST } from "../route";

const resolveAuthority = jest.mocked(resolveSiteHomeCaptureAuthority);
const context = { params: Promise.resolve({ siteId: "site-a" }) };
function request(siteId: string, body: unknown) { return new NextRequest("http://localhost/api/sites/site-a/visual-certification", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": "org-a", "x-gcp-site-id": siteId }, body: JSON.stringify(body) }); }

describe("site-home visual certification route", () => {
  beforeEach(() => jest.clearAllMocks());
  it("rejects cross-site scope before authority resolution", async () => { expect((await POST(request("site-b", { page: "HOME" }), context)).status).toBe(403); expect(resolveAuthority).not.toHaveBeenCalled(); });
  it("accepts only the governed HOME identity", async () => { expect((await POST(request("site-a", { page: "OTHER", url: "https://evil.example" }), context)).status).toBe(403); expect(resolveAuthority).not.toHaveBeenCalled(); });
});