import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, forwardOperatorMutationContext, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";

import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetFailed,
  markGlwFailedCampaignTargetDraftReady,
  reconcileGlwCampaignTargetContentReady,
  releaseExpiredGlwCampaignTargetLeases,
  requeueGlwCampaignTargetAfterPreExecutionFailure,
  reconcileGlwContentReadyTargetDraft,
} from "@/modules/glw/campaign-target-repository";
import { listRenderedVisualCertifications, listRenderedVisualOwnerDecisions } from "@/modules/foundation/rendered-visual-certification-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { projectAuthoritativeGeneratedPage } from "@/modules/glw/authoritative-generated-page-projection";
import {
  resolveGlwCampaignJobReconciliationDecision,
} from "@/modules/glw/campaign-target-reconciliation";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";

function internalHeaders(
  request: NextRequest,
  organizationId: string,
  siteId: string,
): Headers {
  return forwardOperatorMutationContext(request, {
    "content-type": "application/json",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": siteId,
  });
}

function targetIdentity(target: {
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
}) {
  return {
    stateCode: target.stateCode,
    citySlug: target.citySlug ?? null,
    cityName: target.cityName ?? null,
  };
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      campaignId: string;
    }>;
  },
) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId } = await context.params;

  const body = await request.json().catch(() => null) as {
    confirm?: string;
  } | null;

  if (body?.confirm !== "RECONCILE_EXISTING_DRAFT_BATCH") {
    return NextResponse.json(
      {
        error:
          "Explicit reconciliation confirmation is required.",
      },
      {
        status: 400,
      },
    );
  }

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId,
  );

  if (!campaign) {
    return NextResponse.json(
      {
        error: "Campaign was not found.",
      },
      {
        status: 404,
      },
    );
  }
  if (campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releasedExpiredLeaseCount = releaseExpiredGlwCampaignTargetLeases(campaignId);

  const reconcilableTargets =
    listGlwCampaignTargets(campaignId).filter(
      (target) =>
        (
          target.status === "running"
          || target.status === "content_ready"
          || target.status === "failed"
        )
        && Boolean(target.jobId),
    );

  const origin = request.nextUrl.origin;

  const results: Array<Record<string, unknown>> = [];

  for (const target of reconcilableTargets) {
    const jobId = target.jobId!;

    try {
      if (target.status === "content_ready") {
        const job = await glwPageExecutionRepository.getById(jobId);
        if (!job) throw new Error("CONTENT_READY_JOB_NOT_FOUND");
        const certifications = listRenderedVisualCertifications({ organizationId: target.organizationId, siteId: target.siteId });
        const ownerDecisions = certifications.flatMap((certification) => listRenderedVisualOwnerDecisions(certification.certificationId));
        const projection = projectAuthoritativeGeneratedPage({ target, job, certifications, ownerDecisions });
        if (projection.target.status !== "draft_ready" || !projection.target.wordpressObjectId) {
          results.push({ ...targetIdentity(target), jobId, action: "wait", generationStatus: job.status, error: "CURRENT_APPROVED_DRAFT_CERTIFICATION_REQUIRED" });
          continue;
        }
        const updated = reconcileGlwContentReadyTargetDraft({ campaignId, stateCode: target.stateCode, citySlug: target.citySlug, targetId: target.targetId, jobId, wordpressObjectId: projection.target.wordpressObjectId });
        results.push({ ...targetIdentity(target), jobId, action: "draft_ready", wordpressObjectId: updated.wordpressObjectId });
        continue;
      }

      const refreshUrl = new URL(
        "/api/glw/page-generation",
        origin,
      );

      refreshUrl.searchParams.set(
        "jobId",
        jobId,
      );

      refreshUrl.searchParams.set(
        "refresh",
        "true",
      );

      const refreshResponse = await fetch(
        refreshUrl,
        {
          method: "GET",
          headers: internalHeaders(
            request,
            target.organizationId,
            target.siteId,
          ),
          cache: "no-store",
        },
      );

      const refreshPayload =
        await refreshResponse.json();

      let job = refreshPayload.job;

      if (!job) {
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "error",
          error:
            refreshPayload.error
            ?? "Recovery returned no generation job.",
        });

        continue;
      }

      let decision =
        resolveGlwCampaignJobReconciliationDecision(
          job,
        );

      if (decision.action === "continue" && job.status === "CONTENT_READY" && job.externalExecutionId) {
        const updated = reconcileGlwCampaignTargetContentReady({
          campaignId,
          targetId: target.targetId,
          stateCode: target.stateCode,
          citySlug: target.citySlug,
          jobId,
          leaseId: target.leaseId ?? "",
          externalExecutionId: job.externalExecutionId,
        });
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "content_ready",
          targetStatus: updated.target.status,
          attemptCount: updated.target.attemptCount,
          leaseHistory: updated.leaseHistory,
        });
        continue;
      }

      if (decision.action === "continue") {
        const { form } =
          buildGlwCampaignProductionGenerationForm({
            campaign,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
          });

        if (form.publicationIntent !== "draft") {
          throw new Error(
            "Campaign reconciliation rejected non-draft generation authority.",
          );
        }

        const continueResponse = await fetch(
          new URL(
            "/api/glw/page-generation",
            origin,
          ),
          {
            method: "POST",
            headers: internalHeaders(
              request,
              target.organizationId,
              target.siteId,
            ),
            body: JSON.stringify({
              form,
              action: "continue",
              jobId,
            }),
            cache: "no-store",
          },
        );

        const continuePayload =
          await continueResponse.json();

        if (!continueResponse.ok) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: continueResponse.status,
            error:
              continuePayload.error
              ?? continuePayload.issues
              ?? "Exact job continuation failed.",
          });

          continue;
        }

        job = continuePayload.job;

        decision =
          resolveGlwCampaignJobReconciliationDecision(
            job,
          );
      }

      if (decision.action === "draft_ready") {
        const updateInput = {
          campaignId,
          stateCode: target.stateCode,
          citySlug: target.citySlug,
          jobId,
          wordpressObjectId:
            decision.wordpressObjectId,
        };

        const updated =
          target.status === "failed"
            ? markGlwFailedCampaignTargetDraftReady(updateInput)
            : markGlwCampaignTargetDraftReady(updateInput);

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "draft_ready",
          wordpressObjectId:
            updated.wordpressObjectId,
        });

        continue;
      }

      if (decision.action === "failed") {
        const updated =
          markGlwCampaignTargetFailed({
            campaignId,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
            jobId,
            error: decision.error,
          });

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "failed",
          error: updated.lastError,
        });

        continue;
      }

      if (decision.action === "requeue") {
        const updated = requeueGlwCampaignTargetAfterPreExecutionFailure({
          campaignId,
          stateCode: target.stateCode,
          citySlug: target.citySlug,
          jobId,
          error: decision.error,
        });
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "requeued",
          error: updated.lastError,
        });
        continue;
      }

      results.push({
        ...targetIdentity(target),
        jobId,
        action: "wait",
        generationStatus: job.status,
      });
    }
    catch (error) {
      results.push({
        ...targetIdentity(target),
        jobId,
        action: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown reconciliation error.",
      });
    }
  }

  return NextResponse.json({
    campaignId,
    reconciledTargetCount:
      reconcilableTargets.length,
    releasedExpiredLeaseCount,
    results,
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}
