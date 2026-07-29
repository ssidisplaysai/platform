import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getInventoryReservationById } from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
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

  const { reservationId } = await context.params;
  const reservation = getInventoryReservationById(reservationId);

  if (
    !reservation ||
    reservation.organizationId !== scope.organizationId ||
    (scope.siteId && reservation.siteId !== scope.siteId)
  ) {
    return NextResponse.json({ error: "Reservation Not Found" }, { status: 404 });
  }

  return NextResponse.json({ reservation });
}
