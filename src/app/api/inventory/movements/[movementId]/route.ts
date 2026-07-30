import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { getInventoryMovementById } from "@/modules/foundation/inventory-repository";

type RouteContext = {
  params: Promise<{ movementId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { movementId } = await context.params;
  const movement = getInventoryMovementById(movementId);

  if (!movement) {
    return NextResponse.json({ error: "Inventory Movement Not Found" }, { status: 404 });
  }

  return NextResponse.json({ movement });
}
