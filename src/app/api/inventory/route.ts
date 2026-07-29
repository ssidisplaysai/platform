import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { filterInventoryStock } from "@/modules/foundation/inventory-selectors";
import { listInventoryStock } from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "inventory:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inventory = filterInventoryStock(listInventoryStock(), {
    organizationId: scope.organizationId ?? undefined,
    siteId: scope.siteId ?? undefined,
    query: request.nextUrl.searchParams.get("query") ?? undefined,
  });

  return NextResponse.json({ inventory });
}
