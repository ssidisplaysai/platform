import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getInventoryMovementById,
  listInventoryLocations,
} from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ movementId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "inventory:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { movementId } = await context.params;
  const movement = getInventoryMovementById(movementId);

  if (!movement || movement.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Inventory Movement Not Found" }, { status: 404 });
  }

  if (scope.siteId) {
    const locations = listInventoryLocations();
    const sourceSiteId = movement.sourceLocationId
      ? locations.find((location) => location.locationId === movement.sourceLocationId)?.siteId ?? null
      : null;
    const destinationSiteId = movement.destinationLocationId
      ? locations.find((location) => location.locationId === movement.destinationLocationId)?.siteId ?? null
      : null;

    if (sourceSiteId !== scope.siteId && destinationSiteId !== scope.siteId) {
      return NextResponse.json({ error: "Inventory Movement Not Found" }, { status: 404 });
    }
  }

  return NextResponse.json({ movement });
}
