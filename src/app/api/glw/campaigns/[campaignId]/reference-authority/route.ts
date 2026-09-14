import { NextRequest, NextResponse } from "next/server";
import { resolveGlwReferenceOwnerLiveContext } from "@/modules/glw/reference-owner-live-context";
import {
  issueGlwReferenceOwnerGrant,
  issueGlwReferencePreflightReceipt,
  GlwReferenceOwnerAuthorityError,
  type GlwReferenceOwnerOperationType,
} from "@/modules/glw/reference-owner-authority";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  return NextResponse.json({
    authorityPrimitive: "GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1",
    principalAuthority: principal.ok ? principal.principal.authority : "UNAVAILABLE",
    principalSessionBound: principal.ok,
    callerSuppliedRoleHeadersAuthorize: false,
    available: principal.ok,
    prerequisite: principal.ok ? null : principal.message,
  }, { status: principal.ok ? 200 : 503 });
}

export async function POST(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  if (!principal.ok) return NextResponse.json({ error: principal.message, code: principal.code, downstreamSideEffectsPerformed: false }, { status: 503 });
  const { campaignId } = await context.params;
  const body = await request.json().catch(() => null) as {
    action?: "RUN_PREFLIGHT" | "AUTHORIZE";
    operationType?: GlwReferenceOwnerOperationType;
    organizationId?: string;
    siteId?: string;
    referenceState?: string;
    failedJobId?: string | null;
    failedArtifactSha256?: string | null;
    preflightReceiptId?: string;
  } | null;
  if (!body?.action || !body.operationType || !body.organizationId || !body.siteId || !body.referenceState) {
    return NextResponse.json({ error: "Exact reference authority request is required.", code: "REFERENCE_AUTHORITY_REQUEST_INVALID", downstreamSideEffectsPerformed: false }, { status: 400 });
  }
  try {
    const liveContext = await resolveGlwReferenceOwnerLiveContext({
      organizationId: body.organizationId,
      siteId: body.siteId,
      campaignId,
      referenceState: body.referenceState,
      operationType: body.operationType,
      failedJobId: body.failedJobId,
      failedArtifactSha256: body.failedArtifactSha256,
    });
    if (body.action === "RUN_PREFLIGHT") {
      const receipt = issueGlwReferencePreflightReceipt({ principal: principal.principal, context: liveContext });
      return NextResponse.json({ receipt, generationPerformed: false });
    }
    if (!body.preflightReceiptId) return NextResponse.json({ error: "Exact preflight receipt is required.", code: "PREFLIGHT_REQUIRED", downstreamSideEffectsPerformed: false }, { status: 400 });
    const grant = issueGlwReferenceOwnerGrant({ principal: principal.principal, preflightReceiptId: body.preflightReceiptId, liveContext });
    return NextResponse.json({ grant, generationPerformed: false });
  } catch (error) {
    const code = error instanceof GlwReferenceOwnerAuthorityError
      ? error.code
      : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "REFERENCE_AUTHORITY_FAILED";
    return NextResponse.json({ error: "Reference owner authority failed closed.", code, downstreamSideEffectsPerformed: false }, { status: 409 });
  }
}