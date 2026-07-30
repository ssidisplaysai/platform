import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { getCustomerById, updateCustomerContact } from "@/modules/foundation/customer-repository";
import type { UpdateCustomerContactInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    customerId: string;
    contactId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "contacts:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId, contactId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const patch = (await request.json()) as UpdateCustomerContactInput;
  const result = updateCustomerContact(customerId, contactId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId,
    organizationId: customer.organizationId,
    type: "contact_updated",
    actor: "api",
    summary: `Contact ${result.contact.contactId} updated for customer account.`,
  });

  return NextResponse.json({ contact: result.contact });
}
