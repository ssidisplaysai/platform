import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
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
  if (!isAuthorized(request, "contacts:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ contacts: listCustomerContacts(customerId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "contacts:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
