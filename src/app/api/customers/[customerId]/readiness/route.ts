import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, resolveRequestRoles } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { evaluateCustomerReadinessById, getCustomerById } from "@/modules/foundation/customer-repository";
import { resolvePermissions } from "@/modules/foundation/permissions";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "customers:evaluate_readiness")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const permissions = resolvePermissions(resolveRequestRoles(request));
  const readiness = evaluateCustomerReadinessById({
    customerId,
    requiredPermission: "customers:evaluate_readiness",
    permissions,
  });

  if (!readiness) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId: customer.customerId,
    organizationId: customer.organizationId,
    type: "customer_readiness_evaluated",
    actor: "api",
    summary: `Customer readiness evaluated with status ${readiness.status}.`,
  });

  return NextResponse.json({ readiness });
}
