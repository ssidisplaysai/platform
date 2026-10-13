import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { inspectWordPressCanonicalHost, repairWordPressCanonicalHost } from "@/modules/foundation/wordpress-canonical-host";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
async function scoped(request: NextRequest, context: Context) { const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId); return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null; }

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try { return NextResponse.json({ inspection: await inspectWordPressCanonicalHost(site), mutationPerformed: false }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "CANONICAL_HOST_INSPECTION_FAILED" }, { status: 409 }); }
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "REPAIR_CANONICAL_HTTPS_HOST") return NextResponse.json({ error: "Explicit canonical-host repair confirmation is required." }, { status: 400 });
  try { const repair = await repairWordPressCanonicalHost(site); return NextResponse.json({ repair, inspection: await inspectWordPressCanonicalHost(site), mutationPerformed: repair.created || repair.activated }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "CANONICAL_HOST_REPAIR_FAILED" }, { status: 409 }); }
}
