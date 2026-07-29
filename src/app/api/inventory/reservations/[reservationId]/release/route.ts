import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { releaseInventoryReservation } from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "inventory:release_reservation")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reservationId } = await context.params;
  const body = (await request.json()) as { actorReference: string };

  const result = releaseInventoryReservation({
    reservationId,
    actorReference: body.actorReference,
  });

  if (!result.validation.valid || !result.reservation) {
    return NextResponse.json(
      { error: "Invalid State Transition", issues: result.validation.issues },
      { status: 400 },
    );
  }

  recordInventoryActivity({
    organizationId: result.reservation.organizationId,
    productId: result.reservation.productId,
    locationId: result.reservation.locationId,
    type: "reservation_released",
    actor: body.actorReference,
    summary: `Reservation ${reservationId} released.`,
  });

  return NextResponse.json({ reservation: result.reservation });
}
