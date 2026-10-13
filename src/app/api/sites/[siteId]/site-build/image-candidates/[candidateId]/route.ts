import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { readSitePageImageCandidateBytes } from "@/modules/foundation/site-page-image-candidate-repository";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string; candidateId: string }> }) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status }); const scope = resolveRequestScope(request); const { siteId, candidateId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || site.organizationId !== scope.organizationId || (scope.siteId && scope.siteId !== site.siteId)) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const stored = readSitePageImageCandidateBytes({ organizationId: site.organizationId, siteId: site.siteId, candidateId }); if (!stored) return NextResponse.json({ error: "Image candidate not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(stored.bytes), { status: 200, headers: { "Content-Type": stored.candidate.mimeType, "Cache-Control": "private, no-store", "Content-Length": String(stored.bytes.length) } });
}