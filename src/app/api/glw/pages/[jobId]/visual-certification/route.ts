import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { governedCaptureFailureCode, parseGeneratedPageCaptureRequest } from "@/modules/foundation/governed-render-capture-security";
import { resolveGeneratedPageCaptureAuthority, runGovernedRenderCapture } from "@/modules/foundation/governed-render-capture-orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ jobId: string }> };
const actor = (roles: readonly string[]) => roles.includes("platform_admin") ? "platform_admin" : "authorized_operator";

function status(error: string): number {
  if (/PAGE_NOT_FOUND/.test(error)) return 404;
  if (/AUTHORITY|SCOPE|ORIGIN|PRIVATE|REDIRECT|REQUEST_INVALID/.test(error)) return 403;
  if (/ALREADY_RUNNING|CONCURRENCY|STALE|MISMATCH/.test(error)) return 409;
  if (/TIMEOUT/.test(error)) return 504;
  return 422;
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!scope.organizationId || !scope.siteId) return NextResponse.json({ error: "Exact organization and site scope are required." }, { status: 403 });
  try {
    const body = parseGeneratedPageCaptureRequest(await request.json().catch(() => ({})));
    const { jobId } = await context.params;
    const authority = await resolveGeneratedPageCaptureAuthority({ organizationId: scope.organizationId, siteId: scope.siteId, jobId });
    const result = await runGovernedRenderCapture({ authority, mode: body.mode, actor: actor(auth.roles) });
    return NextResponse.json({ ...result, captureRequest: { jobId, mode: body.mode }, mutationPerformed: false }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const code = governedCaptureFailureCode(error);
    return NextResponse.json({ error: code, mutationPerformed: false, publicationPerformed: false, wordpressMutationPerformed: false }, { status: status(code) });
  }
}