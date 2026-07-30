import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordInventoryActivity } from "@/modules/foundation/inventory-audit";
import { applyInventoryCount, createInventoryCount, listInventoryCounts } from "@/modules/foundation/inventory-repository";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "inventory:read_internal")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ counts: listInventoryCounts() });
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
    if (!isAuthorized(request, "inventory:approve_count")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (!isAuthorized(request, "inventory:count")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
