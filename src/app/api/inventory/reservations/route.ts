import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { createInventoryReservation, listInventoryReservations } from "@/modules/foundation/inventory-repository";
import type { NewInventoryReservationInput } from "@/modules/foundation/types";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "inventory:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reservations = listInventoryReservations().filter((reservation) => {
    if (reservation.organizationId !== scope.organizationId) {
      return false;
    }

    if (scope.siteId && reservation.siteId !== scope.siteId) {
      return false;
    }

    return true;
  });

  return NextResponse.json({ reservations });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "inventory:reserve");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
