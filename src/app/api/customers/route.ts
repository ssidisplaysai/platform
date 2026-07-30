import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { createCustomer, listCustomers } from "@/modules/foundation/customer-repository";
import type {
  CustomerAccountType,
  CustomerLifecycleState,
  NewCustomerInput,
} from "@/modules/foundation/types";

function parseLifecycleState(value: string | null): CustomerLifecycleState | undefined {
  if (!value) {
    return undefined;
  }

  const values: readonly CustomerLifecycleState[] = [
    "prospect",
    "active",
    "inactive",
    "suspended",
    "archived",
  ];

  return values.includes(value as CustomerLifecycleState)
    ? (value as CustomerLifecycleState)
    : undefined;
}

function parseAccountType(value: string | null): CustomerAccountType | undefined {
  if (!value) {
    return undefined;
  }

  const values: readonly CustomerAccountType[] = [
    "direct",
    "dealer",
    "distributor",
    "partner",
    "internal",
    "other",
  ];

  return values.includes(value as CustomerAccountType)
    ? (value as CustomerAccountType)
    : undefined;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "customers:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const customers = listCustomers({
    organizationId: searchParams.get("organizationId") ?? undefined,
    lifecycleState: parseLifecycleState(searchParams.get("lifecycleState")),
    accountType: parseAccountType(searchParams.get("accountType")),
    siteId: searchParams.get("siteId") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    enabled: searchParams.get("enabled") === "true"
      ? true
      : searchParams.get("enabled") === "false"
        ? false
        : undefined,
  });

  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "customers:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewCustomerInput;
  const result = createCustomer(body);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.customer) {
    return NextResponse.json({ error: "Unable to create customer." }, { status: 400 });
  }

  recordCustomerActivity({
    customerId: result.customer.customerId,
    organizationId: result.customer.organizationId,
    type: "customer_created",
    actor: "api",
    summary: "Customer account created through bounded customer foundation API.",
  });

  return NextResponse.json({ customer: result.customer }, { status: 201 });
}
