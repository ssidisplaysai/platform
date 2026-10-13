import { NextRequest, NextResponse } from "next/server";
import { resolveGlwReferenceOwnerLiveContext } from "@/modules/glw/reference-owner-live-context";
import {
  issueGlwReferenceOwnerGrant,
  issueGlwReferencePreflightReceipt,
  GlwReferenceOwnerAuthorityError,
  projectGlwReferenceOwnerGrant,
  type GlwReferenceOwnerOperationType,
} from "@/modules/glw/reference-owner-authority";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  let grant = null;
  let grantProjectionError: string | null = null;
  const operationType = request.nextUrl.searchParams.get("operationType") as GlwReferenceOwnerOperationType | null;
  const organizationId = request.nextUrl.searchParams.get("organizationId");
  const siteId = request.nextUrl.searchParams.get("siteId");
  const referenceState = request.nextUrl.searchParams.get("referenceState");
  const referenceCitySlug = request.nextUrl.searchParams.get("referenceCitySlug");
  if (principal.ok && operationType && organizationId && siteId && referenceState) {
    const { campaignId } = await context.params;
    try {
      const liveContext = await resolveGlwReferenceOwnerLiveContext({
        operationType,
        organizationId,
        siteId,
        campaignId,
        referenceState,
        referenceCitySlug,
        failedJobId: request.nextUrl.searchParams.get("failedJobId"),
        failedArtifactSha256: request.nextUrl.searchParams.get("failedArtifactSha256"),
      });
      grant = projectGlwReferenceOwnerGrant({ principal: principal.principal, liveContext });
    } catch (error) {
      grantProjectionError = error instanceof Error ? error.message : "REFERENCE_GRANT_PROJECTION_FAILED";
    }
  }
  return NextResponse.json({
    authorityPrimitive: "GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1",
    principalAuthority: principal.ok ? principal.principal.authority : "UNAVAILABLE",
    principalSessionBound: principal.ok,
    callerSuppliedRoleHeadersAuthorize: false,
    available: principal.ok,
    prerequisite: principal.ok ? null : principal.message,
    grant,
    grantProjectionError,
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
    referenceCitySlug?: string;
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
      referenceCitySlug: body.referenceCitySlug,
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