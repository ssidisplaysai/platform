import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { readSiteIntelligenceAsset } from "@/modules/foundation/site-intelligence-asset-store";
import { getSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string; assetId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId, assetId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const asset = getSiteIntelligenceWorkspace(siteId)?.creativeInputs.find((input) => input.binaryAsset?.assetId === assetId)?.binaryAsset;
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  const bytes = readSiteIntelligenceAsset(asset);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": asset.mediaType, "Content-Length": String(bytes.length), "Content-Disposition": `inline; filename="${asset.originalFileName}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}