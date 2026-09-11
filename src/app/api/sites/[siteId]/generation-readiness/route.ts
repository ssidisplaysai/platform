import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { certifyGenerationReadiness } from "@/modules/foundation/site-generation-readiness-repository";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
async function scoped(request: NextRequest, context: Context) { const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId); return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null; }

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const result = getSiteGenerationReadiness(site);
  return NextResponse.json({ site: { organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }, readiness: result.readiness, certification: result.certification, buildSession: result.buildSession, certificationPerformed: false });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "CERTIFY_GENERATION_READINESS") return NextResponse.json({ error: "Explicit Generation Readiness certification is required." }, { status: 400 });
  const result = getSiteGenerationReadiness(site);
  if (!result.readiness.readyToCertify) return NextResponse.json({ error: "Generation Readiness is blocked.", blockers: result.readiness.blockers }, { status: 409 });
  const certification = certifyGenerationReadiness({ organizationId: site.organizationId, siteId: site.siteId, actor: "site-owner", readiness: result.readiness });
  return NextResponse.json({ certification, certificationPerformed: true, siteBuildStarted: false });
}