import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { evaluateInventoryAvailability } from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "inventory:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
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

  if (organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && siteId && siteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
