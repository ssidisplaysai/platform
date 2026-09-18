import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { executeGaRichCompositionApplyRepair, GA_RICH_COMPOSITION_REPAIR_IDENTITY } from "@/modules/glw/ga-rich-composition-apply-repair-service";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

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
  expectedWordpressStatus?: string;
  expectedStoredSha256?: string;
};

const allowedRequestKeys = [
  "operation",
  "expectedCampaignId",
  "expectedTargetId",
  "expectedJobId",
  "expectedExternalExecutionId",
  "expectedWordpressObjectId",
  "expectedWordpressStatus",
  "expectedStoredSha256",
] as const;

function validSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  if (
    !auth.roles.includes("platform_admin")
    || scope.organizationId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId
    || scope.siteId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId
    || jobId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId
  ) {
    return NextResponse.json({ error: "Exact GA repair scope required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RepairRequestBody | null;
  const exactKeys = Object.keys(body ?? {});
  if (
    !body
    || body.operation !== "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT"
    || !body.expectedCampaignId
    || !body.expectedTargetId
    || !body.expectedJobId
    || !body.expectedExternalExecutionId
    || !body.expectedWordpressObjectId
    || !body.expectedWordpressStatus
    || !body.expectedStoredSha256
    || !validSha256(body.expectedStoredSha256)
    || exactKeys.some((key) => !allowedRequestKeys.includes(key as (typeof allowedRequestKeys)[number]))
  ) {
    return NextResponse.json({ error: "Exact GA rich composition repair identity is required." }, { status: 400 });
  }

  if (
    body.expectedCampaignId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId
    || body.expectedTargetId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId
    || body.expectedJobId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId
    || body.expectedExternalExecutionId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId
    || body.expectedWordpressObjectId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || body.expectedWordpressStatus !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
  ) {
    return NextResponse.json({ error: "GA rich composition repair identity mismatch." }, { status: 409 });
  }

  try {
    const repaired = await executeGaRichCompositionApplyRepair({
      actor: principal.principal.principalId,
      expectedStoredSha256: body.expectedStoredSha256.trim().toLowerCase(),
    });

    return NextResponse.json({
      ...repaired,
      wordpressMutationPerformed: repaired.accounting.wordpressMutations > 0,
      publicationPerformed: false,
      dispatchPerformed: false,
      workflowExecuted: false,
      regenerationPerformed: false,
      mediaRegenerationPerformed: false,
      imageGenerationRequested: false,
      n8nDispatchRequested: false,
      wordpressCreateRequested: false,
    }, { status: repaired.mutationPerformed ? 201 : 200 });
  } catch (error) {
    const source = error instanceof Error ? error.message : "GA_RICH_REPAIR_FAILED";
    return NextResponse.json({
      error: source.split(":")[0],
      wordpressMutationPerformed: false,
      publicationPerformed: false,
      dispatchPerformed: false,
      workflowExecuted: false,
      regenerationPerformed: false,
      mediaRegenerationPerformed: false,
      imageGenerationRequested: false,
      n8nDispatchRequested: false,
      wordpressCreateRequested: false,
    }, { status: 409 });
  }
}