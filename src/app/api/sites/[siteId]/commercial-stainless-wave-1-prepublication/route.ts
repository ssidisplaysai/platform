import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { inspectCommercialStainlessWordPressWave1Prepublication } from "@/modules/foundation/commercial-stainless-wordpress-staging";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try {
    const results = await inspectCommercialStainlessWordPressWave1Prepublication(site);
    return NextResponse.json({ results, readyCount: results.filter((result) => result.status === "PREPUBLICATION_READY").length, nativePreviewAvailable: false, mutationPerformed: false });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "COMMERCIAL_STAINLESS_PREPUBLICATION_RECHECK_FAILED", mutationPerformed: false }, { status: 409 });
  }
}