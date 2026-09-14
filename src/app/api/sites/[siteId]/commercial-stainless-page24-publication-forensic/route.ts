import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { inspectCommercialStainlessPage24PublicationFailure } from "@/modules/foundation/commercial-stainless-page24-publication-forensic";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try {
    return NextResponse.json(await inspectCommercialStainlessPage24PublicationFailure(site));
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "COMMERCIAL_STAINLESS_PAGE24_FORENSIC_FAILED", mutationPerformed: false }, { status: 409 });
  }
}