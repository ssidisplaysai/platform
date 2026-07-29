import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { evaluateInventoryAvailability } from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "inventory:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const productId = request.nextUrl.searchParams.get("productId");
  const organizationId = request.nextUrl.searchParams.get("organizationId");
  const siteId = request.nextUrl.searchParams.get("siteId");

  if (!productId || !organizationId) {
    return NextResponse.json(
      { error: "Validation Error", detail: "organizationId and productId are required." },
      { status: 400 },
    );
  }

  try {
    const availability = evaluateInventoryAvailability({
      organizationId,
      productId,
      siteId: siteId ?? null,
    });

    return NextResponse.json({ availability });
  } catch (error) {
    return NextResponse.json(
      { error: "Validation Error", detail: (error as Error).message },
      { status: 400 },
    );
  }
}
