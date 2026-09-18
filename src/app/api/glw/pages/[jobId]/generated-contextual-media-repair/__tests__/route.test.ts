import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: jest.fn(),
  resolveRequestScope: jest.fn(),
}));

jest.mock("@/modules/glw/trusted-operator-principal", () => ({
  resolveGlwTrustedOperatorPrincipal: jest.fn(),
}));

jest.mock("@/modules/glw/generated-page-review-read-model", () => ({
  buildGeneratedPageReviewModel: jest.fn(),
}));

jest.mock("@/modules/glw/contextual-media-production-service", () => ({
  executeDraftReadyGeneratedContextualMediaRepair: jest.fn(),
}));

jest.mock("@/modules/glw/outdoor-sphere-contextual-media-policy", () => ({
  requiresGeneratedContextualMediaForOutdoorSphere: jest.fn(),
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: { getById: jest.fn() },
}));

import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";
import { executeDraftReadyGeneratedContextualMediaRepair } from "@/modules/glw/contextual-media-production-service";
import { requiresGeneratedContextualMediaForOutdoorSphere } from "@/modules/glw/outdoor-sphere-contextual-media-policy";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { POST } from "../route";

const auth = jest.mocked(authorizeRequest);
const scope = jest.mocked(resolveRequestScope);
const principal = jest.mocked(resolveGlwTrustedOperatorPrincipal);
const buildModel = jest.mocked(buildGeneratedPageReviewModel);
const executeRepair = jest.mocked(executeDraftReadyGeneratedContextualMediaRepair);
const strictScope = jest.mocked(requiresGeneratedContextualMediaForOutdoorSphere);
const getJob = jest.mocked(glwPageExecutionRepository.getById);

const context = { params: Promise.resolve({ jobId: "job-fl" }) };

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/glw/pages/job-fl/generated-contextual-media-repair",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("draft-ready generated contextual repair route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockReturnValue({ ok: true, status: 200, error: null, roles: ["platform_admin"] });
    scope.mockReturnValue({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production" });
    principal.mockReturnValue({ ok: true, principal: { principalId: "operator-1", sessionId: "session-1", authority: "SESSION" } });
    strictScope.mockReturnValue(true);
    getJob.mockResolvedValue({ jobId: "job-fl", productId: "prod-outdoor-digital-sphere", state: "Florida", city: "Fort Lauderdale" } as never);
    buildModel.mockResolvedValue({
      identity: { campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview", targetId: "target-fl", lifecycleState: "draft_ready" },
      wordpress: { status: "draft", objectId: "31001", verified: true },
      trace: { jobId: "job-fl", externalExecutionId: "exec-1" },
      richComposition: { plan: { identity: { pageRevisionIdentity: "job:job-fl:2026-09-18T10:00:00.000Z" } } },
      actions: { generatedContextualRepair: { identity: { expectedStoredSha256: "a".repeat(64) } } },
    } as never);
  });

  test("requires authenticated authority", async () => {
    principal.mockReturnValueOnce({ ok: false, code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE", message: "missing" });
    const response = await POST(request({}), context);
    expect(response.status).toBe(401);
  });

  test("requires exact request body", async () => {
    const response = await POST(request({ operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA" }), context);
    expect(response.status).toBe(400);
  });

  test("fails closed on identity mismatch", async () => {
    const response = await POST(request({
      operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-fl",
      expectedJobId: "job-fl",
      expectedExternalExecutionId: "exec-1",
      expectedWordpressObjectId: "31001",
      expectedProductId: "prod-outdoor-digital-sphere",
      expectedPageRevisionId: "job:job-fl:2026-09-18T10:00:00.000Z",
      expectedStoredSha256: "b".repeat(64),
    }), context);
    expect(response.status).toBe(409);
    expect(executeRepair).not.toHaveBeenCalled();
  });

  test("executes bounded draft-ready contextual repair", async () => {
    executeRepair.mockResolvedValueOnce({
      ownerDecision: "PENDING",
      accounting: { imageGenerationRequests: 1, wordpressMutations: 1 },
    } as never);
    const response = await POST(request({
      operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA",
      expectedCampaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      expectedTargetId: "target-fl",
      expectedJobId: "job-fl",
      expectedExternalExecutionId: "exec-1",
      expectedWordpressObjectId: "31001",
      expectedProductId: "prod-outdoor-digital-sphere",
      expectedPageRevisionId: "job:job-fl:2026-09-18T10:00:00.000Z",
      expectedStoredSha256: "a".repeat(64),
    }), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA",
      publicationPerformed: false,
      dispatchPerformed: false,
      regenerationPerformed: false,
      visualCertificationPerformed: false,
    });
    expect(executeRepair).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      targetId: "target-fl",
      stateName: "Florida",
      cityName: "Fort Lauderdale",
      expectedStoredSha256: "a".repeat(64),
      actor: "operator-1",
    }));
  });
});
