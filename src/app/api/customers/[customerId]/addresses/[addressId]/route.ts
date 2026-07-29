import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { getCustomerById, updateCustomerAddress } from "@/modules/foundation/customer-repository";
import type { UpdateCustomerAddressInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    customerId: string;
    addressId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "addresses:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId, addressId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const patch = (await request.json()) as UpdateCustomerAddressInput;
  const result = updateCustomerAddress(customerId, addressId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId,
    organizationId: customer.organizationId,
    type: "address_updated",
    actor: "api",
    summary: `Address ${result.address.addressId} updated for customer account.`,
  });

  return NextResponse.json({ address: result.address });
}
