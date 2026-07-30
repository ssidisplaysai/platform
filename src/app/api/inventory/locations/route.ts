import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { listInventoryLocations, validateInventoryLocations } from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    locations: listInventoryLocations(),
    hierarchyValidation: validateInventoryLocations(),
  });
}
