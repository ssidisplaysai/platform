import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolveSiteHomeCaptureAuthority, runGovernedRenderCapture } from "@/modules/foundation/governed-render-capture-orchestrator";
import { governedCaptureFailureCode, parseSiteHomeCaptureRequest } from "@/modules/foundation/governed-render-capture-security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ siteId: string }> };
const actor = (roles: readonly string[]) => roles.includes("platform_admin") ? "platform_admin" : "authorized_operator";

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params;
  if (!scope.organizationId || !scope.siteId || scope.siteId !== siteId) return NextResponse.json({ error: "Exact organization and site scope are required." }, { status: 403 });
  try {
    const body = parseSiteHomeCaptureRequest(await request.json().catch(() => null));
    const authority = resolveSiteHomeCaptureAuthority({ organizationId: scope.organizationId, siteId });
    const result = await runGovernedRenderCapture({ authority, mode: body.mode, actor: actor(auth.roles) });
    return NextResponse.json({ ...result, captureRequest: { siteId, page: "HOME", mode: body.mode }, mutationPerformed: false }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const code = governedCaptureFailureCode(error);
    const status = /PAGE_NOT_FOUND/.test(code) ? 404 : /AUTHORITY|SCOPE|ORIGIN|PRIVATE|REDIRECT|REQUEST_INVALID/.test(code) ? 403 : /ALREADY_RUNNING|CONCURRENCY|MISMATCH/.test(code) ? 409 : /TIMEOUT/.test(code) ? 504 : 422;
    return NextResponse.json({ error: code, mutationPerformed: false, publicationPerformed: false, wordpressMutationPerformed: false }, { status });
  }
}