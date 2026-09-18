import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: jest.fn(),
  resolveRequestScope: jest.fn(),
}));

jest.mock("@/modules/glw/trusted-operator-principal", () => ({
  resolveGlwTrustedOperatorPrincipal: jest.fn(),
}));

jest.mock("@/modules/glw/ga-rich-composition-apply-repair-service", () => ({
  executeGaRichCompositionApplyRepair: jest.fn(),
  inspectGaRichCompositionApplyRepairPreflight: jest.fn(),
  GA_RICH_COMPOSITION_REPAIR_IDENTITY: {
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
    targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
    jobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
    externalExecutionId: "703853",
    wordpressObjectId: "20169",
    wordpressStatus: "draft",
  },
}));

import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { executeGaRichCompositionApplyRepair, inspectGaRichCompositionApplyRepairPreflight } from "@/modules/glw/ga-rich-composition-apply-repair-service";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import { GET, POST } from "../route";

const auth = jest.mocked(authorizeRequest);
const scope = jest.mocked(resolveRequestScope);
const principal = jest.mocked(resolveGlwTrustedOperatorPrincipal);
const execute = jest.mocked(executeGaRichCompositionApplyRepair);
const inspect = jest.mocked(inspectGaRichCompositionApplyRepairPreflight);

const context = { params: Promise.resolve({ jobId: "cb4684bf-477c-45f2-98c3-a37717368b83" }) };

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/glw/pages/cb4684bf-477c-45f2-98c3-a37717368b83/rich-composition-apply-repair",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function getRequest() {
  return new NextRequest(
    "http://localhost/api/glw/pages/cb4684bf-477c-45f2-98c3-a37717368b83/rich-composition-apply-repair",
    {
      method: "GET",
      headers: {
        "x-gcp-roles": "platform_admin",
        "x-gcp-organization-id": "led-display-warehouse",
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
    },
  );
}

describe("GA rich composition apply repair route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockReturnValue({ ok: true, status: 200, error: null, roles: ["platform_admin"] });
    scope.mockReturnValue({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production" });
    principal.mockReturnValue({ ok: true, principal: { principalId: "operator-1", sessionId: "session-1", authority: "SESSION" } });
  });

  it("permits only exact GA draft update identity", async () => {
    execute.mockResolvedValueOnce({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      jobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
      targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      wordpressObjectId: "20169",
      wordpressStatus: "draft",
      mutationPerformed: true,
      accounting: {
        wordpressUpdates: 1,
        wordpressCreates: 0,
        wordpressMutations: 1,
        imageGenerationRequests: 0,
        n8nDispatchRequests: 0,
        publicationRequests: 0,
      },
      verification: {
        readbackHashMatchesWrittenRichHtml: true,
        legacyProductImageAbsent: true,
        contextualHeroPresent: true,
        singleH1: true,
        contentMatch: true,
      },
      visualCertificationStateBefore: "CURRENT",
      visualCertificationStateAfter: "STALE",
      beforeHash: "a".repeat(64),
      afterHash: "b".repeat(64),
      richHash: "b".repeat(64),
      actor: "operator-1",
    });

    const response = await POST(request({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
      expectedJobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
      expectedExternalExecutionId: "703853",
      expectedWordpressObjectId: "20169",
      expectedWordpressStatus: "draft",
      expectedStoredSha256: "a".repeat(64),
    }), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledWith({ actor: "operator-1", expectedStoredSha256: "a".repeat(64) });
    expect(body).toMatchObject({
      wordpressMutationPerformed: true,
      publicationPerformed: false,
      dispatchPerformed: false,
      mediaRegenerationPerformed: false,
      imageGenerationRequested: false,
      n8nDispatchRequested: false,
      wordpressCreateRequested: false,
    });
  });

  it("returns strict read-only preflight hash without mutation", async () => {
    inspect.mockResolvedValueOnce({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      identity: {
        campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
        targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
        jobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
        externalExecutionId: "703853",
        wordpressObjectId: "20169",
        wordpressStatus: "draft",
      },
      currentStoredSha256: "a".repeat(64),
      title: "Outdoor Digital Sphere in Georgia",
      canonicalPath: "outdoor-digital-sphere/georgia",
      wordpressParentId: 124,
      visualCertificationState: "CURRENT",
    });

    const response = await GET(getRequest(), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      currentStoredSha256: "a".repeat(64),
      wordpressMutationPerformed: false,
      imageGenerationRequested: false,
      n8nDispatchRequested: false,
    });
  });

  it("rejects different wordpress object identity", async () => {
    const response = await POST(request({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
      expectedJobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
      expectedExternalExecutionId: "703853",
      expectedWordpressObjectId: "99999",
      expectedWordpressStatus: "draft",
      expectedStoredSha256: "a".repeat(64),
    }), context);

    expect(response.status).toBe(409);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects non-draft status and wrong execution identity", async () => {
    const wrongStatus = await POST(request({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
      expectedJobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
      expectedExternalExecutionId: "703853",
      expectedWordpressObjectId: "20169",
      expectedWordpressStatus: "publish",
      expectedStoredSha256: "a".repeat(64),
    }), context);
    expect(wrongStatus.status).toBe(409);

    const wrongExecution = await POST(request({
      operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
      expectedJobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
      expectedExternalExecutionId: "703854",
      expectedWordpressObjectId: "20169",
      expectedWordpressStatus: "draft",
      expectedStoredSha256: "a".repeat(64),
    }), context);
    expect(wrongExecution.status).toBe(409);
    expect(execute).not.toHaveBeenCalled();
  });
});