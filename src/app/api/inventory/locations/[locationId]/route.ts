import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  evaluateLocationAvailability,
  getInventoryLocationById,
  listInventoryReservations,
  listInventoryStock,
  listInventoryMovements,
} from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ locationId: string }>;
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

  const { locationId } = await context.params;
  const location = getInventoryLocationById(locationId);

  if (
    !location ||
    !isRecordInScope({
      recordOrganizationId: location.organizationId,
      recordSiteId: location.siteId,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Location Not Found" }, { status: 404 });
  }

  const stockRecords = listInventoryStock().filter(
    (stock) => stock.locationId === locationId && stock.organizationId === scope.organizationId,
  );
  const reservations = listInventoryReservations().filter(
    (reservation) =>
      reservation.locationId === locationId && reservation.organizationId === scope.organizationId,
  );
  const movements = listInventoryMovements().filter((movement) => {
    if (movement.organizationId !== scope.organizationId) {
      return false;
    }

    return movement.sourceLocationId === locationId || movement.destinationLocationId === locationId;
  });

  return NextResponse.json({
    location,
    stockRecords,
    reservations,
    movements,
    summary: evaluateLocationAvailability(locationId),
  });
}
