import { NextRequest, NextResponse } from "next/server";

import { readLocalPageThemingMedia } from "@/modules/foundation/local-context-page-theming-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params;
  if (request.nextUrl.searchParams.get("organizationId") !== "ssi" || request.nextUrl.searchParams.get("siteId") !== "site-ssi-projectorenclosure") return new NextResponse("Exact scope required", { status: 403 });
  const artifact = readLocalPageThemingMedia({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, mediaId });
  if (!artifact) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(artifact.bytes), { headers: { "content-type": artifact.item.mimeType, "content-length": String(artifact.bytes.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } });
}
