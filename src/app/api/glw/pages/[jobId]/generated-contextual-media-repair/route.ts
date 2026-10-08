import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";
import { executeDraftReadyGeneratedContextualMediaRepair } from "@/modules/glw/contextual-media-production-service";
import { requiresGeneratedContextualMediaForOutdoorSphere } from "@/modules/glw/outdoor-sphere-contextual-media-policy";
import { requiresGeneratedContextualMediaForProjectorEnclosure } from "@/modules/glw/projector-enclosure-contextual-media-policy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Context = { params: Promise<{ jobId: string }> };
type RepairRequestBody = {
  operation?: string;
  expectedCampaignId?: string;
  expectedTargetId?: string;
  expectedJobId?: string;
  expectedExternalExecutionId?: string;
  expectedWordpressObjectId?: string;
  expectedProductId?: string;
  expectedPageRevisionId?: string;
  expectedStoredSha256?: string;
};

const allowedRequestKeys = [
  "operation",
  "expectedCampaignId",
  "expectedTargetId",
  "expectedJobId",
  "expectedExternalExecutionId",
  "expectedWordpressObjectId",
  "expectedProductId",
  "expectedPageRevisionId",
  "expectedStoredSha256",
] as const;

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.roles.includes("platform_admin") || !scope.organizationId || !scope.siteId) {
    return NextResponse.json({ error: "Exact platform_admin scope is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RepairRequestBody | null;
  if (
    !body
    || body.operation !== "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA"
    || !body.expectedCampaignId
    || !body.expectedTargetId
    || !body.expectedJobId
    || !body.expectedExternalExecutionId
    || !body.expectedWordpressObjectId
    || !body.expectedProductId
    || !body.expectedPageRevisionId
    || !body.expectedStoredSha256
    || Object.keys(body).some((key) => !allowedRequestKeys.includes(key as (typeof allowedRequestKeys)[number]))
  ) {
    return NextResponse.json({ error: "Exact draft-ready generated contextual repair identity is required." }, { status: 400 });
  }

  const { jobId } = await context.params;
  const model = await buildGeneratedPageReviewModel({ jobId, organizationId: scope.organizationId, siteId: scope.siteId });
  const job = await glwPageExecutionRepository.getById(jobId);
  if (!model || !job || !job.state) {
    return NextResponse.json({ error: "Exact draft-ready page authority not found." }, { status: 404 });
  }

  const strictScope = requiresGeneratedContextualMediaForOutdoorSphere({
    campaignId: model.identity.campaignId,
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    productId: job.productId,
  }) || requiresGeneratedContextualMediaForProjectorEnclosure({
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    productId: job.productId,
  });
  if (!strictScope || model.identity.lifecycleState !== "draft_ready" || model.wordpress.status !== "draft" || !model.wordpress.objectId) {
    return NextResponse.json({ error: "Exact draft-ready contextual repair scope required." }, { status: 409 });
  }
  if (!model.actions.generatedContextualRepair) {
    return NextResponse.json({ error: "Generated contextual draft repair is not eligible for this page." }, { status: 409 });
  }

  const expectedIdentity = {
    campaignId: model.identity.campaignId,
    targetId: model.identity.targetId,
    jobId: model.trace.jobId,
    externalExecutionId: model.trace.externalExecutionId ?? "",
    wordpressObjectId: model.wordpress.objectId,
    productId: job.productId,
    pageRevisionId: model.richComposition.plan.identity.pageRevisionIdentity,
    expectedStoredSha256: model.actions.generatedContextualRepair.identity.expectedStoredSha256,
  };
  if (
    body.expectedCampaignId !== expectedIdentity.campaignId
    || body.expectedTargetId !== expectedIdentity.targetId
    || body.expectedJobId !== expectedIdentity.jobId
    || body.expectedExternalExecutionId !== expectedIdentity.externalExecutionId
    || body.expectedWordpressObjectId !== expectedIdentity.wordpressObjectId
    || body.expectedProductId !== expectedIdentity.productId
    || body.expectedPageRevisionId !== expectedIdentity.pageRevisionId
    || body.expectedStoredSha256 !== expectedIdentity.expectedStoredSha256
  ) {
    return NextResponse.json({ error: "Draft-ready contextual repair identity mismatch." }, { status: 409 });
  }

  try {
    const repaired = await executeDraftReadyGeneratedContextualMediaRepair({
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      campaignId: expectedIdentity.campaignId,
      targetId: expectedIdentity.targetId,
      productId: expectedIdentity.productId,
      stateName: job.state,
      cityName: job.city,
      expectedStoredSha256: expectedIdentity.expectedStoredSha256,
      actor: principal.principal.principalId,
    });
    return NextResponse.json({
      operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA",
      ownerDecision: repaired.ownerDecision,
      mediaRegenerationPerformed: repaired.accounting.imageGenerationRequests > 0,
      wordpressMutationPerformed: repaired.accounting.wordpressMutations > 0,
      publicationPerformed: false,
      dispatchPerformed: false,
      workflowExecuted: false,
      regenerationPerformed: false,
      visualCertificationPerformed: false,
    }, { status: repaired.accounting.imageGenerationRequests > 0 ? 201 : 200 });
  } catch (error) {
    const source = error instanceof Error ? error.message : "DRAFT_READY_CONTEXTUAL_REPAIR_FAILED";
    return NextResponse.json({
      error: source.split(":")[0],
      wordpressMutationPerformed: false,
      publicationPerformed: false,
      dispatchPerformed: false,
      workflowExecuted: false,
      regenerationPerformed: false,
      visualCertificationPerformed: false,
    }, { status: 409 });
  }
}
