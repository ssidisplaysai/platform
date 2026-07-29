import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import {
  applyInventoryCount,
  createInventoryCount,
  listInventoryCounts,
  listInventoryLocations,
} from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "inventory:read_internal");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locationById = new Map(
    listInventoryLocations().map((location) => [location.locationId, location]),
  );

  const counts = listInventoryCounts().filter((count) => {
    if (count.organizationId !== scope.organizationId) {
      return false;
    }

    if (!scope.siteId) {
      return true;
    }

    return locationById.get(count.locationId)?.siteId === scope.siteId;
  });

  return NextResponse.json({ counts });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    mode: "submit" | "apply";
    organizationId?: string;
    locationId?: string;
    productId?: string;
    countedQuantity?: number;
    actor: string;
    countId?: string;
  };

  if (body.mode === "apply") {
    const auth = authorizeRequest(request, "inventory:approve_count");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!body.countId) {
      return NextResponse.json({ error: "Validation Error", detail: "countId is required." }, { status: 400 });
    }

    const result = applyInventoryCount({
      countId: body.countId,
      actor: body.actor,
    });

    if (!result.validation.valid || !result.count) {
      return NextResponse.json({ error: "Invalid State Transition", issues: result.validation.issues }, { status: 400 });
    }

    recordInventoryActivity({
      organizationId: result.count.organizationId,
      productId: result.count.productId,
      locationId: result.count.locationId,
      type: "inventory_count_applied",
      actor: body.actor,
      summary: `Inventory count ${result.count.countId} applied.`,
    });

    return NextResponse.json({ count: result.count });
  }

  const auth = authorizeRequest(request, "inventory:count");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.organizationId || !body.locationId || !body.productId || body.countedQuantity === undefined) {
    return NextResponse.json(
      { error: "Validation Error", detail: "organizationId, locationId, productId, countedQuantity are required." },
      { status: 400 },
    );
  }

  const result = createInventoryCount({
    organizationId: body.organizationId,
    locationId: body.locationId,
    productId: body.productId,
    countedQuantity: body.countedQuantity,
    actor: body.actor,
  });

  if (!result.validation.valid || !result.count) {
    return NextResponse.json({ error: "Validation Error", issues: result.validation.issues }, { status: 400 });
  }

  recordInventoryActivity({
    organizationId: result.count.organizationId,
    productId: result.count.productId,
    locationId: result.count.locationId,
    type: "inventory_count_submitted",
    actor: body.actor,
    summary: `Inventory count ${result.count.countId} submitted.`,
  });

  return NextResponse.json({ count: result.count }, { status: 201 });
}
