import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { startSiteBuild } from "@/modules/foundation/site-generation-readiness-repository";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string; certificationId?: string } | null;
  if (body?.confirm !== "START_SITE_BUILD") return NextResponse.json({ error: "Explicit Site Build confirmation is required." }, { status: 400 });
  const result = getSiteGenerationReadiness(site);
  if (result.certification.status !== "CURRENT" || !result.certification.certification || body.certificationId !== result.certification.certification.certificationId) return NextResponse.json({ error: "Current Generation Readiness certification is required." }, { status: 409 });
  const session = startSiteBuild({ organizationId: site.organizationId, siteId: site.siteId, actor: "site-owner", certification: result.certification.certification });
  return NextResponse.json({ session, wordpressMutation: false, publicationMutation: false });
}