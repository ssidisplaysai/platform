import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/governed-render-capture-orchestrator", () => ({
  resolveGeneratedPageCaptureAuthority: jest.fn(),
  runGovernedRenderCapture: jest.fn(),
}));

import { resolveGeneratedPageCaptureAuthority, runGovernedRenderCapture } from "@/modules/foundation/governed-render-capture-orchestrator";
import { POST } from "../route";

const resolveAuthority = jest.mocked(resolveGeneratedPageCaptureAuthority);
const runCapture = jest.mocked(runGovernedRenderCapture);
const context = { params: Promise.resolve({ jobId: "job-1" }) };
function request(body: unknown, headers: Record<string, string> = {}) { return new NextRequest("http://localhost/api/glw/pages/job-1/visual-certification", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
const scoped = { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": "org", "x-gcp-site-id": "site" };

describe("generated-page visual certification route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires authenticated mutation authority", async () => {
    expect((await POST(request({}), context)).status).toBe(401);
  });

  it.each([{ url: "https://evil.example" }, { host: "127.0.0.1" }, { url: "file:///secret" }, { url: "data:text/html,test" }, { url: "javascript:alert(1)" }])("rejects client-controlled locations %#", async (body) => {
    const response = await POST(request(body, scoped), context);
    expect(response.status).toBe(403); expect(resolveAuthority).not.toHaveBeenCalled();
  });

  it("maps unknown and cross-scope authority failures without leaking internals", async () => {
    resolveAuthority.mockRejectedValueOnce(new Error("PAGE_NOT_FOUND"));
    expect((await POST(request({}, scoped), context)).status).toBe(404);
    resolveAuthority.mockRejectedValueOnce(new Error("AUTHORITY_MISMATCH"));
    expect((await POST(request({}, scoped), context)).status).toBe(403);
    resolveAuthority.mockRejectedValueOnce(new Error("authorization=Basic secret-value"));
    const response = await POST(request({}, scoped), context); const text = await response.text();
    expect(response.status).toBe(422); expect(text).toContain("CAPTURE_FAILED"); expect(text).not.toContain("secret-value");
  });

  it("returns only bounded non-publication result fields", async () => {
    resolveAuthority.mockResolvedValueOnce({} as never);
    runCapture.mockResolvedValueOnce({ certification: { certificationId: "cert-1" } as never, reused: false, ownerDecision: "PENDING", publicationPerformed: false, wordpressMutationPerformed: false });
    const response = await POST(request({ mode: "CURRENT" }, scoped), context); const body = await response.json();
    expect(response.status).toBe(201); expect(body).toMatchObject({ ownerDecision: "PENDING", mutationPerformed: false, publicationPerformed: false, wordpressMutationPerformed: false });
    expect(JSON.stringify(body)).not.toMatch(/password|authorization|cookie|bearer|token/i);
  });
});