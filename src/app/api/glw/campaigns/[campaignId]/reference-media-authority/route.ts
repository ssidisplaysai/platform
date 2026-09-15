import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestPrincipal, resolveRequestScope } from "@/modules/foundation/api-auth";
import { approveGlwReferenceMediaAuthority, getGlwReferenceMediaAuthority } from "@/modules/glw/reference-media-authority";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { campaignId } = await context.params;
  const scope = resolveRequestScope(request);
  const record = getGlwReferenceMediaAuthority(campaignId, "CA");
  if (!record || scope.organizationId !== record.organizationId || (scope.siteId && scope.siteId !== record.siteId)) {
    return NextResponse.json({ error: "Reference media authority not found." }, { status: 404 });
  }
  return NextResponse.json({ record, mutationPerformed: false });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const principal = resolveRequestPrincipal(request);
  if (!principal) return NextResponse.json({ error: "Authenticated operator session is required." }, { status: 401 });
  const { campaignId } = await context.params;
  const scope = resolveRequestScope(request);
  const body = await request.json().catch(() => null) as {
    action?: string;
    stateCode?: string;
    wordpressMediaId?: string;
    expectedLineageFingerprint?: string;
  } | null;
  if (body?.action !== "APPROVE_REFERENCE_MEDIA" || body.stateCode !== "CA" || body.wordpressMediaId !== "15338" || !body.expectedLineageFingerprint) {
    return NextResponse.json({ error: "Exact California media approval request is required." }, { status: 400 });
  }
  const existing = getGlwReferenceMediaAuthority(campaignId, "CA");
  if (!existing || scope.organizationId !== existing.organizationId || scope.siteId !== existing.siteId) {
    return NextResponse.json({ error: "Reference media authority not found in scope." }, { status: 404 });
  }
  try {
    const record = approveGlwReferenceMediaAuthority({
      campaignId,
      stateCode: "CA",
      wordpressMediaId: "15338",
      expectedLineageFingerprint: body.expectedLineageFingerprint,
      principalId: principal.principalId,
      sessionId: principal.sessionId,
    });
    return NextResponse.json({ record, wordpressMutation: false, publicationMutation: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reference media approval failed." }, { status: 409 });
  }
}