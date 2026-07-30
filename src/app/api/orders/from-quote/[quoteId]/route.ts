import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createSalesOrderFromQuote,
} from "@/modules/foundation/sales-order-repository";
import { getQuoteById } from "@/modules/foundation/quote-repository";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "orders:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await context.params;
  const quote = getQuoteById(quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && quote.siteReference && scope.siteId !== quote.siteReference) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    referenceNumber?: string | null;
  };

  const result = createSalesOrderFromQuote({
    payload: {
      quoteId,
      referenceNumber: body.referenceNumber ?? null,
    },
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.order) {
    return NextResponse.json({ error: "Unable to create sales order from quote." }, { status: 400 });
  }

  return NextResponse.json({ order: result.order }, { status: 201 });
}
