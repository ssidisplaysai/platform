import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { searchOperationRegistry } from "@/modules/foundation/operation-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "operations:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results = searchOperationRegistry({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? request.nextUrl.searchParams.get("siteReference") ?? undefined,
    query,
  });

  return NextResponse.json({ results });
}
