import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
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
  if (!isAuthorized(request, "addresses:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ addresses: listCustomerAddresses(customerId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "addresses:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
