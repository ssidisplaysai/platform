import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
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
  const auth = authorizeRequest(request, "customers:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedOrganizationId = searchParams.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedSiteId = searchParams.get("siteId");
  if (scope.siteId && requestedSiteId && requestedSiteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customers = listCustomers({
    organizationId: scope.organizationId ?? undefined,
    lifecycleState: parseLifecycleState(searchParams.get("lifecycleState")),
    accountType: parseAccountType(searchParams.get("accountType")),
    siteId: scope.siteId ?? requestedSiteId ?? undefined,
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
  const auth = authorizeRequest(request, "customers:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
