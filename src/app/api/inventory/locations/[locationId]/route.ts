import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
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
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { locationId } = await context.params;
  const location = getInventoryLocationById(locationId);

  if (!location) {
    return NextResponse.json({ error: "Location Not Found" }, { status: 404 });
  }

  return NextResponse.json({
    location,
    stockRecords: listInventoryStock().filter((stock) => stock.locationId === locationId),
    reservations: listInventoryReservations().filter((reservation) => reservation.locationId === locationId),
    movements: listInventoryMovements().filter((movement) => movement.sourceLocationId === locationId || movement.destinationLocationId === locationId),
    summary: evaluateLocationAvailability(locationId),
  });
}
