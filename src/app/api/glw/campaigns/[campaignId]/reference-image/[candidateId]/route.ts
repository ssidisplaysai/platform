import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { readGlwReferenceImageCandidateBytes } from "@/modules/glw/campaign-reference-image-candidate-repository";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string; candidateId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId, candidateId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === campaignId
    && candidate.organizationId === scope.organizationId
    && (!scope.siteId || candidate.siteId === scope.siteId));
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const stored = readGlwReferenceImageCandidateBytes({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    candidateId,
  });
  if (!stored) return NextResponse.json({ error: "Image candidate not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(stored.bytes), {
    status: 200,
    headers: {
      "Content-Type": stored.candidate.mimeType,
      "Content-Length": String(stored.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
