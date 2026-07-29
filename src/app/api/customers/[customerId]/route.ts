import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { getCustomerById, updateCustomer } from "@/modules/foundation/customer-repository";
import type { UpdateCustomerInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "customers:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "customers:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const patch = (await request.json()) as UpdateCustomerInput;
  const result = updateCustomer(customerId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId: result.customer.customerId,
    organizationId: result.customer.organizationId,
    type: result.customer.lifecycleState === "archived" ? "customer_archived" : "customer_updated",
    actor: "api",
    summary: "Customer account updated through bounded customer foundation API.",
  });

  return NextResponse.json({ customer: result.customer });
}
