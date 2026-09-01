import { NextRequest, NextResponse } from "next/server";

import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetFailed,
  markGlwFailedCampaignTargetDraftReady,
} from "@/modules/glw/campaign-target-repository";
import {
  resolveGlwCampaignJobReconciliationDecision,
} from "@/modules/glw/campaign-target-reconciliation";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";

function platformHeaders(
  organizationId: string,
  siteId: string,
): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gcp-roles": "platform_admin",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": siteId,
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

  const reconcilableTargets =
    listGlwCampaignTargets(campaignId).filter(
      (target) =>
        (
          target.status === "running"
          || target.status === "failed"
        )
        && Boolean(target.jobId),
    );

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
          headers: platformHeaders(
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
          stateCode: target.stateCode,
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

      if (decision.action === "continue") {
        const { form } =
          buildGlwCampaignProductionGenerationForm({
            campaign,
            stateCode: target.stateCode,
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
            headers: platformHeaders(
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
            stateCode: target.stateCode,
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
        const updated =
          target.status === "failed"
            ? markGlwFailedCampaignTargetDraftReady({
                campaignId,
                stateCode: target.stateCode,
                jobId,
                wordpressObjectId:
                  decision.wordpressObjectId,
              })
            : markGlwCampaignTargetDraftReady({
                campaignId,
                stateCode: target.stateCode,
                jobId,
                wordpressObjectId:
                  decision.wordpressObjectId,
              });

        results.push({
          stateCode: target.stateCode,
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
            jobId,
            error: decision.error,
          });

        results.push({
          stateCode: target.stateCode,
          jobId,
          action: "failed",
          error: updated.lastError,
        });

        continue;
      }

      results.push({
        stateCode: target.stateCode,
        jobId,
        action: "wait",
        generationStatus: job.status,
      });
    }
    catch (error) {
      results.push({
        stateCode: target.stateCode,
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
    results,
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}