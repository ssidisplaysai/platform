import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { createInventoryReservation, listInventoryReservations } from "@/modules/foundation/inventory-repository";
import type { NewInventoryReservationInput } from "@/modules/foundation/types";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ reservations: listInventoryReservations() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "inventory:reserve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewInventoryReservationInput;
  const result = createInventoryReservation(body);

  if (!result.validation.valid || !result.reservation) {
    return NextResponse.json(
      { error: "Validation Error", issues: result.validation.issues },
      { status: 400 },
    );
  }

  recordInventoryActivity({
    organizationId: result.reservation.organizationId,
    productId: result.reservation.productId,
    locationId: result.reservation.locationId,
    type: "reservation_created",
    actor: result.reservation.requestedBy,
    summary: `Reservation ${result.reservation.reservationId} created.`,
  });

  return NextResponse.json({ reservation: result.reservation }, { status: 201 });
}
