import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import {
  createCustomerAddress,
  getCustomerById,
  listCustomerAddresses,
} from "@/modules/foundation/customer-repository";
import type { NewCustomerAddressInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "addresses:read");
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

  return NextResponse.json({ addresses: listCustomerAddresses(customerId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "addresses:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { customerId } = await context.params;
  const body = (await request.json()) as NewCustomerAddressInput;
  const result = createCustomerAddress(customerId, body);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.address) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId,
    organizationId: result.address.organizationId,
    type: "address_created",
    actor: "api",
    summary: `Address ${result.address.addressId} created for customer account.`,
  });

  return NextResponse.json({ address: result.address }, { status: 201 });
}
