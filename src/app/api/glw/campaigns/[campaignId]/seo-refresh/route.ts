import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

type RefreshResult = {
  stateCode: string;
  jobId: string;
  wordpressObjectId: string | null;
  ok: boolean;
  error?: string;
};

function buildHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  for (const name of ["x-gcp-roles", "x-gcp-organization-id", "x-gcp-site-id"]) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  return headers;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;
  if (!campaign) return NextResponse.json({ error: "Campaign was not found." }, { status: 404 });
  if (campaign.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eligible = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.jobId) && Boolean(target.wordpressObjectId))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode))
    .map((target) => ({
      stateCode: target.stateCode,
      jobId: target.jobId,
      wordpressObjectId: target.wordpressObjectId,
    }));

  return NextResponse.json({
    campaignId,
    eligibleCount: eligible.length,
    eligible,
    imageGenerationPerformed: false,
    publicationPerformed: false,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "REFRESH_CAMPAIGN_DRAFT_SEO") {
    return NextResponse.json({ error: "Explicit REFRESH_CAMPAIGN_DRAFT_SEO confirmation is required." }, { status: 400 });
  }

  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;
  if (!campaign) return NextResponse.json({ error: "Campaign was not found." }, { status: 404 });
  if (campaign.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eligible = listGlwCampaignTargets(campaignId)
    .filter((target) => target.status === "draft_ready" && Boolean(target.jobId) && Boolean(target.wordpressObjectId))
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));

  const results: RefreshResult[] = [];
  const headers = buildHeaders(request);

  for (const target of eligible) {
    const response = await fetch(new URL("/api/glw/page-generation/seo-refresh", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        jobId: target.jobId,
        confirm: "REFRESH_EXISTING_DRAFT_SEO",
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as { error?: string; wordpressObjectId?: string } | null;

    if (!response.ok || !payload) {
      results.push({
        stateCode: target.stateCode,
        jobId: target.jobId as string,
        wordpressObjectId: target.wordpressObjectId,
        ok: false,
        error: payload?.error ?? `SEO refresh failed with HTTP ${response.status}.`,
      });
      continue;
    }

    results.push({
      stateCode: target.stateCode,
      jobId: target.jobId as string,
      wordpressObjectId: payload.wordpressObjectId ?? target.wordpressObjectId,
      ok: true,
    });
  }

  const succeeded = results.filter((entry) => entry.ok).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    ok: failed === 0,
    campaignId,
    eligibleCount: eligible.length,
    succeeded,
    failed,
    results,
    imageGenerationPerformed: false,
    publicationPerformed: false,
  });
}
