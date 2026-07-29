import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import {
  createCustomerContact,
  getCustomerById,
  listCustomerContacts,
} from "@/modules/foundation/customer-repository";
import type { NewCustomerContactInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "contacts:read");
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

  return NextResponse.json({ contacts: listCustomerContacts(customerId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "contacts:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { customerId } = await context.params;
  const body = (await request.json()) as NewCustomerContactInput;
  const result = createCustomerContact(customerId, body);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.contact) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  recordCustomerActivity({
    customerId,
    organizationId: result.contact.organizationId,
    type: "contact_created",
    actor: "api",
    summary: `Contact ${result.contact.fullName} added to customer account.`,
  });

  return NextResponse.json({ contact: result.contact }, { status: 201 });
}
