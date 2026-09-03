import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getSiteById } from "@/modules/foundation/site-repository";
import { publishGenesisWordPressDraft } from "@/modules/foundation/wordpress-publish-writer";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  markGlwCampaignTargetPublished,
  summarizeGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;

  if (!campaign || campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const eligible = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.wordpressObjectId))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode))
    .map((target) => ({
      stateCode: target.stateCode,
      wordpressObjectId: target.wordpressObjectId!,
      jobId: target.jobId,
    }));

  return NextResponse.json({
    campaignId,
    eligibleCount: eligible.length,
    eligible,
    publicationPerformed: false,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { confirm?: string; stateCodes?: string[] } | null;
  if (body?.confirm !== "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS") {
    return NextResponse.json({ error: "Explicit publish confirmation is required." }, { status: 400 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;

  if (!campaign || campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const site = getSiteById(campaign.siteId);
  if (!site || site.organizationId !== campaign.organizationId) {
    return NextResponse.json({ error: "Configured campaign site was not found." }, { status: 409 });
  }

  const requestedStates = new Set(
    (body.stateCodes ?? [])
      .map((stateCode) => stateCode.trim().toUpperCase())
      .filter(Boolean),
  );

  const eligible = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.wordpressObjectId))
    .filter((target) => requestedStates.size === 0 || requestedStates.has(target.stateCode))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));

  const results: Array<Record<string, unknown>> = [];

  for (const target of eligible) {
    const wordpressObjectId = target.wordpressObjectId!;

    try {
      const published = await publishGenesisWordPressDraft({
        site,
        wordpressObjectId,
      });

      if (!published.ok) {
        results.push({
          stateCode: target.stateCode,
          wordpressObjectId,
          ok: false,
          error: published.message,
          state: published.state,
        });
        continue;
      }

      const updated = markGlwCampaignTargetPublished({
        campaignId,
        stateCode: target.stateCode,
        wordpressObjectId,
      });

      results.push({
        stateCode: target.stateCode,
        wordpressObjectId: updated.wordpressObjectId,
        wordpressUrl: published.wordpressUrl,
        ok: true,
      });
    } catch (error) {
      results.push({
        stateCode: target.stateCode,
        wordpressObjectId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown campaign publication error.",
      });
    }
  }

  const succeeded = results.filter((entry) => entry.ok === true).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    ok: failed === 0,
    campaignId,
    attempted: results.length,
    succeeded,
    failed,
    results,
    queue: summarizeGlwCampaignTargets(campaignId),
    publicationPerformed: succeeded > 0,
  });
}
