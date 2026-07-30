import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { searchRoutingRegistry } from "@/modules/foundation/routing-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "routings:search");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const results = searchRoutingRegistry({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? params.get("siteReference") ?? undefined,
    query: params.get("query") ?? "",
  });

  return NextResponse.json({ routings: results });
}