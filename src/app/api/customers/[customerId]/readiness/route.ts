import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestRoles,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { evaluateCustomerReadinessById, getCustomerById } from "@/modules/foundation/customer-repository";
import { resolvePermissions } from "@/modules/foundation/permissions";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "customers:evaluate_readiness");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);
  const scopedCustomerVisible =
    customer &&
    customer.organizationId === scope.organizationId &&
    (!scope.siteId ||
      customer.primarySiteId === scope.siteId ||
      customer.associatedSiteIds.includes(scope.siteId));

  if (!scopedCustomerVisible) {
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
