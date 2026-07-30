import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordCustomerActivity } from "@/modules/foundation/customer-audit";
import { detectCustomerDuplicates, getCustomerById } from "@/modules/foundation/customer-repository";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request, "customers:detect_duplicates")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await context.params;
  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const duplicates = detectCustomerDuplicates(customerId);

  recordCustomerActivity({
    customerId,
    organizationId: customer.organizationId,
    type: "duplicate_scan_requested",
    actor: "api",
    summary: `Duplicate scan completed with ${duplicates.length} candidate matches.`,
  });

  return NextResponse.json({ duplicates });
}
