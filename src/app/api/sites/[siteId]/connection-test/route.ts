import { NextRequest, NextResponse } from "next/server";
import { FoundationSiteConnectionTestAdapter } from "@/modules/foundation/site-connection";
import { getSiteById } from "@/modules/foundation/site-repository";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "sites:test_connection")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const adapter = new FoundationSiteConnectionTestAdapter();
  const result = await adapter.testConnection(site);

  recordSiteActivity({
    siteId: site.siteId,
    organizationId: site.organizationId,
    type: "connection_test_requested",
    actor: "api",
    summary: `Connection test completed with status: ${result.status}`,
  });

  return NextResponse.json({ result });
}
