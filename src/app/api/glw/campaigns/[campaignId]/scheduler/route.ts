import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  attachGlwCampaignTargetJob,
  leaseGlwCampaignTargets,
  previewGlwCampaignTargetLease,
  summarizeGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";

type Context = {
  params: Promise<{ campaignId: string }>;
};

function resolveDispatchDate(
  request: NextRequest,
): string {
  const requested = request.nextUrl.searchParams
    .get("dispatchDate")
    ?.trim();

  if (requested) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      throw new Error(
        "dispatchDate must use YYYY-MM-DD.",
      );
    }

    return requested;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function findScopedCampaign(input: {
  campaignId: string;
  organizationId: string;
  siteId?: string;
}) {
  return listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === input.campaignId
      && candidate.organizationId === input.organizationId
      && (
        !input.siteId
        || candidate.siteId === input.siteId
      ),
  ) ?? null;
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(
    request,
    "schedules:read",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Organization scope is required." },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  const campaign = findScopedCampaign({
    campaignId,
    organizationId: scope.organizationId,
    siteId: scope.siteId,
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Only active campaigns have a production schedule.",
      },
      { status: 409 },
    );
  }

  let dispatchDate: string;

  try {
    dispatchDate = resolveDispatchDate(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid dispatch date.",
      },
      { status: 400 },
    );
  }

  const queue = summarizeGlwCampaignTargets(
    campaign.campaignId,
  );

  const preview = previewGlwCampaignTargetLease({
    campaignId: campaign.campaignId,
    pagesPerDay: campaign.pagesPerDay,
    dispatchDate,
  });

  return NextResponse.json({
    campaign: {
      campaignId: campaign.campaignId,
      status: campaign.status,
      pagesPerDay: campaign.pagesPerDay,
      publicationPolicy:
        campaign.publicationPolicy,
    },
    dispatchDate,
    queue,
    schedule: {
      dailyLimit: campaign.pagesPerDay,
      alreadyDispatchedToday:
        preview.alreadyDispatchedToday,
      remainingAllowance: preview.allowance,
      nextTargets: preview.selected.map(
        (target) => ({
          targetId: target.targetId,
          stateCode: target.stateCode,
          status: target.status,
        }),
      ),
    },
    dryRun: true,
  });
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(
    request,
    "schedules:create",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Organization scope is required." },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  const campaign = findScopedCampaign({
    campaignId,
    organizationId: scope.organizationId,
    siteId: scope.siteId,
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Only active campaigns can dispatch production targets.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null) as {
    confirm?: string;
  } | null;

  if (body?.confirm !== "RUN_DRAFT_BATCH") {
    return NextResponse.json(
      {
        error:
          "Explicit RUN_DRAFT_BATCH confirmation is required.",
      },
      { status: 400 },
    );
  }

  const dispatchDate = resolveDispatchDate(request);
  const leaseId = randomUUID();

  const leased = leaseGlwCampaignTargets({
    campaignId: campaign.campaignId,
    pagesPerDay: campaign.pagesPerDay,
    dispatchDate,
    leaseId,
  });

  const results: Array<Record<string, unknown>> = [];

  for (const target of leased) {
    try {
      const { form } =
        buildGlwCampaignProductionGenerationForm({
          campaign,
          stateCode: target.stateCode,
        });

      // Hard safety assertion: campaign execution is not allowed
      // to acquire publication authority in this executor.
      if (form.publicationIntent !== "draft") {
        throw new Error(
          "Production campaign executor rejected non-draft publication intent.",
        );
      }

      const generationResponse = await fetch(
        `${request.nextUrl.origin}/api/glw/page-generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gcp-roles": "platform_admin",
            "x-gcp-organization-id":
              campaign.organizationId,
            "x-gcp-site-id": campaign.siteId,
          },
          body: JSON.stringify({ form }),
          cache: "no-store",
        },
      );

      const payload = await generationResponse
        .json()
        .catch(() => null) as {
          job?: {
            jobId?: string;
            status?: string;
          };
          error?: string;
        } | null;

      const jobId = payload?.job?.jobId?.trim() ?? "";

      if (!generationResponse.ok || !jobId) {
        throw new Error(
          payload?.error
          ?? `Generation dispatch failed with HTTP ${generationResponse.status}.`,
        );
      }

      attachGlwCampaignTargetJob({
        campaignId: campaign.campaignId,
        stateCode: target.stateCode,
        leaseId,
        jobId,
      });

      results.push({
        stateCode: target.stateCode,
        targetId: target.targetId,
        status: "dispatched",
        jobId,
        generationStatus:
          payload?.job?.status ?? null,
      });
    } catch (error) {
      // The target remains running under its lease here.
      // We intentionally do not automatically requeue or retry
      // because the generation endpoint may have accepted a job
      // before a network/response failure. Recovery authority is
      // the next certification slice.
      results.push({
        stateCode: target.stateCode,
        targetId: target.targetId,
        status: "dispatch_error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown campaign dispatch error.",
      });
    }
  }

  return NextResponse.json({
    campaignId: campaign.campaignId,
    dispatchDate,
    leaseId,
    leasedCount: leased.length,
    dispatchedCount: results.filter(
      (entry) => entry.status === "dispatched",
    ).length,
    errorCount: results.filter(
      (entry) => entry.status === "dispatch_error",
    ).length,
    results,
    queue: summarizeGlwCampaignTargets(
      campaign.campaignId,
    ),
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}