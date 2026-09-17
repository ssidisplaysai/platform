import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/api-auth", () => ({ authorizeRequest: jest.fn(() => ({ ok: true })), hasOrganizationScope: jest.fn(() => true), resolveRequestScope: jest.fn(() => ({ organizationId: "org", siteId: "site" })), forwardOperatorMutationContext: jest.fn(() => new Headers()) }));
jest.mock("@/modules/glw/campaign-repository", () => ({ listGlwCampaigns: jest.fn(() => [{ campaignId: "campaign", organizationId: "org", siteId: "site" }]) }));
jest.mock("@/modules/glw/campaign-target-repository", () => ({ listGlwCampaignTargets: jest.fn(() => [{ targetId: "target", campaignId: "campaign", organizationId: "org", siteId: "site", stateCode: "CO", citySlug: null, cityName: null, status: "content_ready", jobId: "job", wordpressObjectId: null }]), releaseExpiredGlwCampaignTargetLeases: jest.fn(() => 0), reconcileGlwContentReadyTargetDraft: jest.fn(() => ({ status: "draft_ready", wordpressObjectId: "20151" })), markGlwCampaignTargetDraftReady: jest.fn(), markGlwCampaignTargetFailed: jest.fn(), markGlwFailedCampaignTargetDraftReady: jest.fn(), reconcileGlwCampaignTargetContentReady: jest.fn(), requeueGlwCampaignTargetAfterPreExecutionFailure: jest.fn() }));
jest.mock("@/modules/glw/page-execution-repository", () => ({ glwPageExecutionRepository: { getById: jest.fn(async () => ({ jobId: "job", organizationId: "org", siteId: "site", externalExecutionId: "683323", status: "CONTENT_READY" })) } }));
jest.mock("@/modules/foundation/rendered-visual-certification-repository", () => ({ listRenderedVisualCertifications: jest.fn(() => [{ certificationId: "cert" }]), listRenderedVisualOwnerDecisions: jest.fn(() => [{ certificationId: "cert", decision: "APPROVED" }]) }));
jest.mock("@/modules/glw/authoritative-generated-page-projection", () => ({ projectAuthoritativeGeneratedPage: jest.fn(({ target }) => ({ target: { ...target, status: "draft_ready", wordpressObjectId: "20151" } })) }));
jest.mock("@/modules/glw/campaign-production-generation", () => ({ buildGlwCampaignProductionGenerationForm: jest.fn() }));
jest.mock("@/modules/glw/campaign-target-reconciliation", () => ({ resolveGlwCampaignJobReconciliationDecision: jest.fn() }));

import { reconcileGlwContentReadyTargetDraft } from "@/modules/glw/campaign-target-repository";
import { POST } from "../route";

describe("approved draft campaign reconciliation", () => {
  test("persists exact draft-ready projection without generation, publication, or dispatch", async () => {
    const network = jest.spyOn(global, "fetch");
    const request = new NextRequest("http://localhost/api/glw/campaigns/campaign/reconcile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "RECONCILE_EXISTING_DRAFT_BATCH" }) });
    const response = await POST(request, { params: Promise.resolve({ campaignId: "campaign" }) });
    expect(response.status).toBe(200);
    expect(reconcileGlwContentReadyTargetDraft).toHaveBeenCalledWith({ campaignId: "campaign", stateCode: "CO", citySlug: null, targetId: "target", jobId: "job", wordpressObjectId: "20151" });
    expect(network).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ reconciledTargetCount: 1, results: [{ stateCode: "CO", action: "draft_ready", wordpressObjectId: "20151" }], publicationPerformed: false });
    network.mockRestore();
  });
});