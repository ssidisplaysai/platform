import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getQuoteById, listQuoteAuditEvents } from "@/modules/foundation/quote-repository";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:view_audit");
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

  if (!isRecordInScope({
    recordOrganizationId: quote.organizationId,
    recordSiteId: quote.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ events: listQuoteAuditEvents(quoteId) });
}
