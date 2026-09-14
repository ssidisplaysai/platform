import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestPrincipal, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { createOwnerExactTargetDispatchGrant } from "@/modules/glw/exact-target-dispatch-authority";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

type Context = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "Owner dispatch authorization requires platform_admin." }, { status: 403 });
  const scope = resolveRequestScope(request);
  const principal = resolveRequestPrincipal(request);
  if (!hasOrganizationScope(scope) || !scope.organizationId || !scope.siteId) return NextResponse.json({ error: "Exact organization and site scope are required." }, { status: 403 });
  if (!principal) return NextResponse.json({ error: "Exact authenticated principal and session are required." }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === campaignId && candidate.organizationId === scope.organizationId && candidate.siteId === scope.siteId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { operation?: string; confirmationMode?: string; preflightReceiptId?: string; targetId?: string } | null;
  if (body?.operation !== "OWNER_EXACT_TARGET_DISPATCH" || body.confirmationMode !== "AUTHORIZE_AND_DISPATCH_EXACT_TARGET" || !body.preflightReceiptId?.trim() || !body.targetId?.trim()) {
    return NextResponse.json({ error: "Exact owner target, preflight, operation, and confirmation are required." }, { status: 400 });
  }
  const target = listGlwCampaignTargets(campaignId).find((candidate) => candidate.targetId === body.targetId) ?? null;
  if (!target) return NextResponse.json({ error: "Exact campaign target not found." }, { status: 404 });
  const runtimeSha = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  if (!SHA_PATTERN.test(runtimeSha)) return NextResponse.json({ error: "Exact running release identity is required." }, { status: 503 });
  try {
    const grant = createOwnerExactTargetDispatchGrant({ preflightReceiptId: body.preflightReceiptId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET" });
    return NextResponse.json({ grant, dispatchPerformed: false, leaseCreated: false, jobCreated: false, workflowExecuted: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Owner dispatch authorization failed." }, { status: 409 });
  }
}
