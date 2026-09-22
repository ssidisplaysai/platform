import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  GLW_REFERENCE_EXECUTION_RETIRE_OPERATION,
  retireGlwReferenceExecutionForProjection,
} from "@/modules/glw/reference-execution-retirement";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);

  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null) as {
    confirm?: string;
    operation?: string;
    stateCode?: string;
    citySlug?: string | null;
    expectedJobId?: string;
    expectedExecutionId?: string;
    expectedCanonicalPath?: string;
    reason?: string;
  } | null;

  if (
    body?.confirm !== "RETIRE_REFERENCE_EXECUTION_FOR_ACTIVE_PROJECTION"
    || body.operation !== GLW_REFERENCE_EXECUTION_RETIRE_OPERATION
    || !body.stateCode?.trim()
    || !body.expectedJobId?.trim()
    || !body.expectedExecutionId?.trim()
    || !body.expectedCanonicalPath?.trim()
    || !body.reason?.trim()
  ) {
    return NextResponse.json({ error: "Explicit governed reference execution retirement request is required." }, { status: 400 });
  }

  try {
    const result = await retireGlwReferenceExecutionForProjection({
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      campaignId,
      stateCode: body.stateCode,
      citySlug: body.citySlug,
      expectedJobId: body.expectedJobId,
      expectedExecutionId: body.expectedExecutionId,
      expectedCanonicalPath: body.expectedCanonicalPath,
      principalId: principal.principal.principalId,
      reason: body.reason,
    });

    return NextResponse.json({
      operation: result.operationType,
      alreadyRetired: result.alreadyRetired,
      jobId: result.jobId,
      targetId: result.targetId,
      retiredAt: result.retiredAt,
      generationAttempted: false,
      publicationPerformed: false,
      wordpressMutationPerformed: false,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Reference execution retirement failed closed.",
      code: error instanceof Error ? error.message : "REFERENCE_EXECUTION_RETIREMENT_FAILED",
      generationAttempted: false,
      publicationPerformed: false,
      wordpressMutationPerformed: false,
    }, { status: 409 });
  }
}
