import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { reverseInventoryMovement } from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ movementId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "inventory:reverse_movement")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { movementId } = await context.params;
  const body = (await request.json()) as {
    actorReference: string;
    reasonCode: string;
    correlationId?: string | null;
  };

  const result = reverseInventoryMovement({
    movementId,
    actorReference: body.actorReference,
    reasonCode: body.reasonCode,
    correlationId: body.correlationId ?? null,
  });

  if (!result.validation.valid || !result.movement) {
    return NextResponse.json(
      { error: "Invalid State Transition", issues: result.validation.issues },
      { status: 400 },
    );
  }

  recordInventoryActivity({
    organizationId: result.movement.organizationId,
    productId: result.movement.productId,
    locationId: result.movement.sourceLocationId ?? result.movement.destinationLocationId,
    type: "movement_reversed",
    actor: body.actorReference,
    summary: `Movement ${movementId} reversed by ${body.actorReference}.`,
  });

  return NextResponse.json({ movement: result.movement });
}
