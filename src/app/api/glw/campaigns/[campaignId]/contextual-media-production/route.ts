import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import { preflightContextualMediaProduction } from "@/modules/glw/contextual-media-production-preflight";
import type { ContextualVisualPlanItem } from "@/modules/glw/contextual-media-production-adapter";
import { executeContextualMediaProduction } from "@/modules/glw/contextual-media-production-service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request); const auth = authorizeRequest(request, "sites:update"); const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { mode?: string; targetId?: string; visualPlan?: ContextualVisualPlanItem[]; expectedStoredSha256?: string } | null;
  if (!body || !["DRY_RUN", "EXECUTE"].includes(body.mode ?? "") || !body.targetId || !Array.isArray(body.visualPlan) || Object.keys(body).some((key) => !["mode", "targetId", "visualPlan", "expectedStoredSha256"].includes(key)) || (body.mode === "EXECUTE" && !body.expectedStoredSha256)) return NextResponse.json({ error: "Exact contextual-media operation authority is required." }, { status: 400 });
  try {
    const { campaignId } = await context.params; const result = body.mode === "DRY_RUN" ? await preflightContextualMediaProduction({ campaignId, targetId: body.targetId, visualPlan: body.visualPlan, actor: principal.principal.principalId }) : await executeContextualMediaProduction({ campaignId, targetId: body.targetId, visualPlan: body.visualPlan, expectedStoredSha256: body.expectedStoredSha256!, actor: principal.principal.principalId });
    if (!("identity" in result)) return NextResponse.json(result);
    const identity = "identity" in result ? result.identity : result.result.identity;
    if (identity.organizationId !== scope.organizationId || identity.siteId !== scope.siteId) return NextResponse.json({ error: "Target scope is forbidden." }, { status: 403 });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CONTEXTUAL_MEDIA_PREFLIGHT_FAILED", imageGenerationRequests: 0, wordpressUploads: 0, wordpressMutations: 0, certificationRuns: 0 }, { status: 409 }); }
}