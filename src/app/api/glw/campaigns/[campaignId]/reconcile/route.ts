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
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
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

function asTrimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
    targetId?: string;
    jobId?: string;
    executionId?: string;
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

  const expectedTargetId = asTrimmed(body?.targetId);
  const expectedJobId = asTrimmed(body?.jobId);
  const expectedExecutionId = asTrimmed(body?.executionId);

  if (expectedTargetId && (!expectedJobId || !expectedExecutionId)) {
    return NextResponse.json({
      error: "Exact target continuation requires targetId, jobId, and executionId.",
    }, { status: 400 });
  }

  const allTargets = listGlwCampaignTargets(campaignId);
  let reconcilableTargets =
    allTargets.filter(
      (target) =>
        (
          target.status === "running"
          || target.status === "content_ready"
          || target.status === "failed"
        )
        && Boolean(target.jobId),
    );

  if (expectedTargetId) {
    const selected = allTargets.find((target) => target.targetId === expectedTargetId) ?? null;
    if (!selected || selected.campaignId !== campaignId) {
      return NextResponse.json({ error: "Selected target does not belong to the exact campaign." }, { status: 409 });
    }
    if (selected.status !== "content_ready") {
      return NextResponse.json({ error: "Selected target is not in a continuable content-ready state." }, { status: 409 });
    }
    if (!selected.jobId || selected.jobId !== expectedJobId) {
      return NextResponse.json({ error: "Selected target does not match the exact existing job." }, { status: 409 });
    }
    if (selected.wordpressObjectId) {
      return NextResponse.json({ error: "Selected target already has a conflicting WordPress identity." }, { status: 409 });
    }
    if (selected.leaseId) {
      return NextResponse.json({ error: "Selected target has an active lease and cannot use content-ready continuation." }, { status: 409 });
    }
    const selectedJob = await glwPageExecutionRepository.getById(selected.jobId);
    if (!selectedJob) {
      return NextResponse.json({ error: "Selected target job was not found." }, { status: 409 });
    }
    if ((selectedJob.externalExecutionId ?? "") !== expectedExecutionId) {
      return NextResponse.json({ error: "Selected target execution identity does not match the exact existing execution." }, { status: 409 });
    }
    if (selectedJob.wordpressStatus === "publish") {
      return NextResponse.json({ error: "Published targets cannot continue through draft continuation." }, { status: 409 });
    }
    if (selectedJob.wordpressObjectId) {
      return NextResponse.json({ error: "Conflicting existing WordPress identity detected on the selected job." }, { status: 409 });
    }
    reconcilableTargets = [selected];
  }

  const origin = request.nextUrl.origin;

  const results: Array<Record<string, unknown>> = [];

  for (const target of reconcilableTargets) {
    const jobId = target.jobId!;

    try {
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

      if (decision.action === "continue" && target.status === "running" && job.status === "CONTENT_READY" && job.externalExecutionId) {
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
              targetId: target.targetId,
              executionId: expectedTargetId ? expectedExecutionId : (job.externalExecutionId ?? null),
            }),
            cache: "no-store",
          },
        );

        const continuePayload =
          await continueResponse.json();

        if (!continueResponse.ok || continuePayload?.ok !== true) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: continueResponse.status,
            error:
              continuePayload.error
              ?? continuePayload.issues
              ?? "Exact job continuation did not reach durable WordPress draft persistence.",
          });

          continue;
        }

        job = continuePayload.job;

        decision =
          resolveGlwCampaignJobReconciliationDecision(
            job,
          );

        if (expectedTargetId && decision.action !== "draft_ready") {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: 409,
            error: "Exact content-ready continuation did not produce a durable draft-ready result.",
          });
          continue;
        }
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
          target.status === "content_ready"
            ? reconcileGlwContentReadyTargetDraft({
                ...updateInput,
                targetId: target.targetId,
              })
            : target.status === "failed"
            ? markGlwFailedCampaignTargetDraftReady(updateInput)
            : markGlwCampaignTargetDraftReady(updateInput);

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "draft_ready",
          wordpressObjectId:
            updated.wordpressObjectId,
          executionIdAfter: job.externalExecutionId ?? null,
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

  if (expectedTargetId) {
    const selectedResult = results[0] ?? null;
    if (!selectedResult || selectedResult.action !== "draft_ready") {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
        error: selectedResult?.error ?? "Exact content-ready continuation failed before durable WordPress draft persistence.",
      }, { status: 409 });
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
