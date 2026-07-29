import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { createInventoryMovement, listInventoryMovements } from "@/modules/foundation/inventory-repository";
import type { NewInventoryMovementInput } from "@/modules/foundation/types";

function movementActivityType(movementType: NewInventoryMovementInput["movementType"]) {
  switch (movementType) {
    case "receipt":
      return "inventory_received" as const;
    case "transfer":
      return "inventory_transferred" as const;
    case "damage":
      return "inventory_damaged" as const;
    case "inspection_hold":
      return "inventory_hold_placed" as const;
    case "inspection_release":
      return "inventory_hold_released" as const;
    case "adjustment_decrease":
    case "adjustment_increase":
    case "count_correction":
      return "inventory_adjusted" as const;
    default:
      return "inventory_issued" as const;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ movements: listInventoryMovements() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "inventory:create_movement")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewInventoryMovementInput;
  const result = createInventoryMovement(body);

  if (!result.validation.valid) {
    return NextResponse.json(
      { error: "Validation Error", issues: result.validation.issues },
      { status: 400 },
    );
  }

  if (!result.movement) {
    return NextResponse.json({ error: "Invalid State Transition" }, { status: 400 });
  }

  recordInventoryActivity({
    organizationId: result.movement.organizationId,
    productId: result.movement.productId,
    locationId: result.movement.sourceLocationId ?? result.movement.destinationLocationId,
    type: movementActivityType(result.movement.movementType),
    actor: result.movement.actorReference,
    summary: `Movement ${result.movement.movementType} completed for quantity ${result.movement.quantity}.`,
  });

  return NextResponse.json({ movement: result.movement }, { status: 201 });
}
