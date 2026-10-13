import { NextRequest, NextResponse } from "next/server";
import { getRenderedVisualCertificationById, readRenderedVisualCaptureArtifact } from "@/modules/foundation/rendered-visual-certification-repository";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ certificationId: string; captureId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const organizationId = request.nextUrl.searchParams.get("organizationId"); const siteId = request.nextUrl.searchParams.get("siteId");
  if (!organizationId || !siteId) return NextResponse.json({ error: "Exact scope required." }, { status: 403 });
  const { certificationId, captureId } = await context.params;
  const certification = getRenderedVisualCertificationById({ organizationId, siteId, certificationId });
  const capture = certification?.captures.find((item) => item.captureId === captureId) ?? null;
  if (!capture) return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  try {
    const bytes = readRenderedVisualCaptureArtifact(capture.screenshotArtifact);
    return new NextResponse(Buffer.from(bytes), { headers: { "content-type": capture.screenshotArtifact.mediaType, "content-length": String(bytes.byteLength), "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Artifact integrity check failed." }, { status: 409 }); }
}