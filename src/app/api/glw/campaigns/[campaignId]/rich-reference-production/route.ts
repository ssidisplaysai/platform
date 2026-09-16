import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolveTargetParameterizedRichReferenceProduction } from "@/modules/glw/target-parameterized-rich-reference-production";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Organization and site scope are required." }, { status: 403 });

  try {
    const { campaignId } = await context.params;
    const readiness = await resolveTargetParameterizedRichReferenceProduction({ campaignId, targetId: request.nextUrl.searchParams.get("targetId") });
    if (readiness.identity.organizationId !== scope.organizationId || readiness.identity.siteId !== scope.siteId) return NextResponse.json({ error: "Target scope is forbidden." }, { status: 403 });
    return NextResponse.json({ readiness, generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, wordpressMutation: false, campaignContinuation: false, publicationMutation: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RICH_REFERENCE_PRODUCTION_PREFLIGHT_FAILED", generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, wordpressMutation: false, campaignContinuation: false, publicationMutation: false }, { status: 409 });
  }
}
