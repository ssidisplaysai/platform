import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try { return NextResponse.json({ review: await inspectSiteBuildWordPressDrafts(site), mutationPerformed: false, publicationMutation: false }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "WORDPRESS_DRAFT_REVIEW_FAILED" }, { status: 409 }); }
}