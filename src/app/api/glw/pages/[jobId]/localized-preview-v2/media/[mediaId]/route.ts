import { NextRequest, NextResponse } from "next/server";
import { readLocalPageThemingMedia } from "@/modules/foundation/local-context-page-theming-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string; mediaId: string }> }) {
  const { jobId, mediaId } = await context.params; const organizationId = request.nextUrl.searchParams.get("organizationId") ?? ""; const siteId = request.nextUrl.searchParams.get("siteId") ?? "";
  const artifact = readLocalPageThemingMedia({ organizationId, siteId, jobId, mediaId }); if (!artifact) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(artifact.bytes), { headers: { "content-type": artifact.item.mimeType, "content-length": String(artifact.bytes.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } });
}