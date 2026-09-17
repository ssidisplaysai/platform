import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { governedCaptureFailureCode, parseGeneratedPageCaptureRequest } from "@/modules/foundation/governed-render-capture-security";
import { resolveGeneratedPageCaptureAuthority, runGovernedRenderCapture } from "@/modules/foundation/governed-render-capture-orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ jobId: string }> };
const actor = (roles: readonly string[]) => roles.includes("platform_admin") ? "platform_admin" : "authorized_operator";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sanitizeDiagnostic(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 240);
}

function captureFailureStage(code: string): string {
  if (/^WORDPRESS_AUTH_FAILED$|^AUTHORITY_MISMATCH$|^PAGE_NOT_FOUND$/.test(code)) return "AUTHORITY_RESOLUTION";
  if (/^CAPTURE_BROWSER_UNAVAILABLE$/.test(code)) return "BROWSER_STARTUP";
  if (/^CAPTURE_(?:TARGET_INVALID|ORIGIN_NOT_ALLOWED|INTERNAL_TARGET_INVALID|INTERNAL_ORIGIN_NOT_CONFIGURED|HTTPS_REQUIRED|PRIVATE_ADDRESS_BLOCKED|REDIRECT_BLOCKED|REDIRECT_LIMIT_EXCEEDED|NAVIGATION_FAILED)$/.test(code)) return "NAVIGATION_GUARD";
  if (/^CAPTURE_TIMEOUT$/.test(code)) return "CAPTURE_EXECUTION";
  if (/^(?:ARTIFACT_TOO_LARGE|CAPTURE_SET_TOO_LARGE|GEOMETRY_EXTRACTION_FAILED)$/.test(code)) return "ARTIFACT_PROCESSING";
  if (/^CAPTURE_RENDER_IDENTITY_MISMATCH$/.test(code)) return "IDENTITY_VALIDATION";
  if (/^CAPTURE_(?:ALREADY_RUNNING|CONCURRENCY_LIMIT)$/.test(code)) return "CONCURRENCY_GUARD";
  if (/^CAPTURE_REQUEST_INVALID$/.test(code)) return "REQUEST_VALIDATION";
  return "UNCLASSIFIED";
}

function captureDiagnostics(error: unknown, fallbackCode: string): { captureErrorCode: string; captureErrorMessage: string; captureFailureStage: string; exceptionName: string } {
  const record = asRecord(error);
  const errorCode = sanitizeDiagnostic(
    record?.code ?? (error instanceof Error ? error.name : null) ?? fallbackCode,
    fallbackCode,
  );
  const errorMessage = sanitizeDiagnostic(
    record?.message ?? (error instanceof Error ? error.message : null) ?? String(error ?? "Unknown capture failure"),
    "Unknown capture failure",
  );
  const exceptionName = sanitizeDiagnostic(error instanceof Error ? error.name : record?.name, "UnknownError");
  return { captureErrorCode: errorCode, captureErrorMessage: errorMessage, captureFailureStage: captureFailureStage(fallbackCode), exceptionName };
}

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
    const diagnostics = captureDiagnostics(error, code);
    console.error("[glw.visual-certification.capture-failed]", {
      route: "POST /api/glw/pages/[jobId]/visual-certification",
      failureCode: code,
      captureFailureStage: diagnostics.captureFailureStage,
      exceptionName: diagnostics.exceptionName,
      captureErrorCode: diagnostics.captureErrorCode,
      captureErrorMessage: diagnostics.captureErrorMessage,
      cause: error,
    });
    return NextResponse.json({
      error: code,
      captureErrorCode: diagnostics.captureErrorCode,
      captureErrorMessage: diagnostics.captureErrorMessage,
      captureFailureStage: diagnostics.captureFailureStage,
      mutationPerformed: false,
      publicationPerformed: false,
      wordpressMutationPerformed: false,
    }, { status: status(code) });
  }
}