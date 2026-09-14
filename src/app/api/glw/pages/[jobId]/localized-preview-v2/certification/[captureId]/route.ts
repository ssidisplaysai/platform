import { NextRequest, NextResponse } from "next/server";
import { getLocalThemeVisualCertification, readLocalThemeVisualArtifact } from "@/modules/foundation/local-theme-visual-certification-repository";
import { getLocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string; captureId: string }> }) {
  const organizationId = request.nextUrl.searchParams.get("organizationId"); const siteId = request.nextUrl.searchParams.get("siteId"); const { jobId, captureId } = await context.params;
  if (!organizationId || !siteId) return new NextResponse("Not found", { status: 404 });
  const bundle = getLocalPageThemingBundle({ organizationId, siteId, jobId });
  const certification = bundle ? getLocalThemeVisualCertification(bundle.bundleId) : null;
  const artifact = certification ? readLocalThemeVisualArtifact({ certificationId: certification.certificationId, captureId }) : null;
  if (!bundle || !certification || !artifact || certification.pageRevisionIdentity !== bundle.context.identity.pageRevisionIdentity) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(artifact.bytes), { headers: { "content-type": "image/png", "content-length": String(artifact.bytes.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } });
}