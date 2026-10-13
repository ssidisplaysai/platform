import { NextRequest } from "next/server";

const authorizeRequest = jest.fn(() => ({ ok: true, status: 200, error: null }));
const resolveRequestScope = jest.fn(() => ({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure" }));
const hasOrganizationScope = jest.fn(() => true);
const isRecordInScope = jest.fn(() => true);

const getSiteById = jest.fn(() => ({
  siteId: "site-ssi-projectorenclosure",
  organizationId: "ssi",
  displayName: "ProjectorEnclosure.com",
  domain: "projectorenclosure.com",
}));

const getSiteIntelligenceWorkspace = jest.fn(() => ({
  strategyState: "STRATEGY_APPROVED",
  creativeState: "CREATIVE_APPROVED",
  strategyRevisions: [{ revision: 2, status: "APPROVED", createdAt: "2026-09-20T00:00:00.000Z" }],
  creativeRevisions: [{ revision: 4 }],
}));

const getSiteAuthorityWorkspace = jest.fn(() => ({ sources: [], candidates: [], progress: { proposed: 0, approved: 0, needReview: 0 } }));
const addUrlSource = jest.fn();
const addOwnerKnowledgeSource = jest.fn();
const decideAuthorityCandidate = jest.fn();
const assertPublicSiteSourceUrl = jest.fn(async (value: string) => value);
const proposeAuthorityCandidatesFromSources = jest.fn();

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: (...args: unknown[]) => authorizeRequest(...args),
  resolveRequestScope: (...args: unknown[]) => resolveRequestScope(...args),
  hasOrganizationScope: (...args: unknown[]) => hasOrganizationScope(...args),
  isRecordInScope: (...args: unknown[]) => isRecordInScope(...args),
}));

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: (...args: unknown[]) => getSiteById(...args),
}));

jest.mock("@/modules/foundation/site-intelligence-repository", () => ({
  getSiteIntelligenceWorkspace: (...args: unknown[]) => getSiteIntelligenceWorkspace(...args),
}));

jest.mock("@/modules/foundation/site-product-authority-repository", () => ({
  getSiteAuthorityWorkspace: (...args: unknown[]) => getSiteAuthorityWorkspace(...args),
  addUrlSource: (...args: unknown[]) => addUrlSource(...args),
  addOwnerKnowledgeSource: (...args: unknown[]) => addOwnerKnowledgeSource(...args),
  decideAuthorityCandidate: (...args: unknown[]) => decideAuthorityCandidate(...args),
  assertPublicSiteSourceUrl: (...args: unknown[]) => assertPublicSiteSourceUrl(...args),
  proposeAuthorityCandidatesFromSources: (...args: unknown[]) => proposeAuthorityCandidatesFromSources(...args),
}));

import { POST } from "../route";

const context = { params: Promise.resolve({ siteId: "site-ssi-projectorenclosure" }) };

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/sites/site-ssi-projectorenclosure/product-authority", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("product authority route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSiteAuthorityWorkspace.mockReturnValue({ sources: [], candidates: [], progress: { proposed: 0, approved: 0, needReview: 0 } });
  });

  test("supports explicit bounded source proposal action", async () => {
    const response = await POST(request({ action: "PROPOSE_CANDIDATES_FROM_SOURCES", sourceIds: ["source-1"] }), context);
    expect(response.status).toBe(200);
    expect(proposeAuthorityCandidatesFromSources).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      sourceIds: ["source-1"],
      actor: "site-owner",
    }));
  });

  test("fails closed for unsupported action", async () => {
    const response = await POST(request({ action: "UNKNOWN_ACTION" }), context);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("PRODUCT_AUTHORITY_ACTION_UNSUPPORTED");
    expect(proposeAuthorityCandidatesFromSources).not.toHaveBeenCalled();
  });
});
