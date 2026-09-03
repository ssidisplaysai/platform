import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { FoundationSiteConnectionTestAdapter } from "@/modules/foundation/site-connection";
import { getSiteById } from "@/modules/foundation/site-repository";
import { configureProjectorEnclosureSiteStudio, PROJECTOR_ENCLOSURE_PROFILE_IDS, PROJECTOR_ENCLOSURE_SITE_ID } from "@/modules/foundation/projectorenclosure-site-studio-configuration";

export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  if (scope.organizationId !== "ssi" || siteId !== PROJECTOR_ENCLOSURE_SITE_ID || (scope.siteId && scope.siteId !== siteId)) return NextResponse.json({ error: "ProjectorEnclosure site scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "CONFIGURE_PROJECTORENCLOSURE_SITE_STUDIO") return NextResponse.json({ error: "Explicit ProjectorEnclosure configuration confirmation is required." }, { status: 400 });
  const site = getSiteById(siteId);
  if (!site) return NextResponse.json({ error: "ProjectorEnclosure site was not found." }, { status: 404 });
  const connection = await new FoundationSiteConnectionTestAdapter().testConnection(site);
  if (connection.status !== "success") return NextResponse.json({ error: "Authenticated ProjectorEnclosure WordPress connection failed." }, { status: 409 });
  try {
    const result = configureProjectorEnclosureSiteStudio();
    return NextResponse.json({ configured: result.siteReadiness.ready && result.productReadiness.ready,
      profileIds: PROJECTOR_ENCLOSURE_PROFILE_IDS, profileReadiness: result.profileReadiness,
      siteReadiness: result.siteReadiness, productReadiness: result.productReadiness, wordpressMutationPerformed: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ProjectorEnclosure configuration failed." }, { status: 409 });
  }
}