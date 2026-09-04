import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  configureSsiSiteStudio,
  ensureSsiSiteRecord,
  SSI_PROFILE_IDS,
  SSI_SITE_ID,
} from "@/modules/foundation/ssi-site-studio-configuration";
import { FoundationSiteConnectionTestAdapter } from "@/modules/foundation/site-connection";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  if (!hasOrganizationScope(scope) || scope.organizationId !== "ssi" || siteId !== SSI_SITE_ID || (scope.siteId && scope.siteId !== siteId)) {
    return NextResponse.json({ error: "SSI site scope is required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "CONFIGURE_SSI_SITE_STUDIO_READINESS") {
    return NextResponse.json({ error: "Explicit SSI configuration confirmation is required." }, { status: 400 });
  }

  try {
    const site = getSiteById(siteId) ?? ensureSsiSiteRecord();
    const connection = await new FoundationSiteConnectionTestAdapter().testConnection(site);
    if (connection.status !== "passed") {
      return NextResponse.json({ error: "Authenticated SSI WordPress connection verification failed." }, { status: 409 });
    }
    const result = configureSsiSiteStudio();
    return NextResponse.json({
      configured: result.siteReadiness.ready && result.productReadiness.ready,
      siteId,
      profileIds: SSI_PROFILE_IDS,
      profileReadiness: result.profileReadiness,
      siteReadiness: result.siteReadiness,
      productReadiness: result.productReadiness,
      wordpressConnectionVerified: true,
      wordpressMutationPerformed: false,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SSI configuration failed." }, { status: 409 });
  }
}