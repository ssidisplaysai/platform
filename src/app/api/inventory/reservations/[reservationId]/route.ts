import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { getInventoryReservationById } from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reservationId } = await context.params;
  const reservation = getInventoryReservationById(reservationId);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation Not Found" }, { status: 404 });
  }

  return NextResponse.json({ reservation });
}
